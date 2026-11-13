import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { appUrl, env, integrations, requiresIntegrations } from "../env";
import { badRequest, notConfigured } from "../errors";

/**
 * File storage behind presigned URLs: the browser uploads/downloads directly, the API
 * only hands out short-lived URLs.
 *  - S3_BUCKET set   → AWS S3 presigned PUT / GET (credentials from the default AWS chain).
 *  - not set (dev)   → files under ./.uploads, served by /api/uploads/local with an HMAC token,
 *                      so uploads work locally without an AWS account.
 */

const UPLOAD_TTL = 10 * 60; // seconds
const DOWNLOAD_TTL = 5 * 60;
const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

let s3: S3Client | undefined;
const s3Client = () => (s3 ??= new S3Client({ region: env().AWS_REGION }));

function assertStorage() {
  if (!integrations.s3() && requiresIntegrations()) throw notConfigured("File storage is not configured. Set S3_BUCKET.");
}

export async function createUploadUrl(key: string, contentType: string) {
  assertStorage();
  if (integrations.s3()) {
    const command = new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: key, ContentType: contentType });
    return { url: await getSignedUrl(s3Client(), command, { expiresIn: UPLOAD_TTL }), method: "PUT" as const, headers: { "Content-Type": contentType } };
  }
  return { url: localUrl(key, "PUT", UPLOAD_TTL), method: "PUT" as const, headers: { "Content-Type": contentType } };
}

export async function createDownloadUrl(key: string, fileName: string) {
  assertStorage();
  if (integrations.s3()) {
    const command = new GetObjectCommand({
      Bucket: env().S3_BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
    });
    return getSignedUrl(s3Client(), command, { expiresIn: DOWNLOAD_TTL });
  }
  return localUrl(key, "GET", DOWNLOAD_TTL, fileName);
}

/** Size in bytes of a stored object, or null when it hasn't been uploaded. */
export async function objectSize(key: string): Promise<number | null> {
  try {
    if (integrations.s3()) {
      const head = await s3Client().send(new HeadObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
      return head.ContentLength ?? 0;
    }
    return (await stat(localPath(key))).size;
  } catch {
    return null;
  }
}

/** Server-side upload for small files received by a server action (avatars, EPC certificates). */
export async function putObject(key: string, body: Uint8Array, contentType: string) {
  assertStorage();
  if (integrations.s3()) {
    await s3Client().send(new PutObjectCommand({ Bucket: env().S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

/** Read a whole object (used for small public media such as service images). */
export async function readObject(key: string): Promise<{ body: Uint8Array<ArrayBuffer>; contentType: string | null } | null> {
  try {
    if (integrations.s3()) {
      const object = await s3Client().send(new GetObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
      if (!object.Body) return null;
      return { body: new Uint8Array(await object.Body.transformToByteArray()), contentType: object.ContentType ?? null };
    }
    return { body: new Uint8Array(await readFile(localPath(key))), contentType: null };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  try {
    if (integrations.s3()) await s3Client().send(new DeleteObjectCommand({ Bucket: env().S3_BUCKET, Key: key }));
    else await rm(localPath(key), { force: true });
  } catch (error) {
    console.error("[storage] delete failed", key, error);
  }
}

// ─── Local development backend ──────────────────────────────────────────────

type LocalToken = { key: string; method: "PUT" | "GET"; exp: number; name?: string };

function sign(value: string) {
  return createHmac("sha256", env().AUTH_SECRET).update(`storage:${value}`).digest("base64url");
}

function localUrl(key: string, method: "PUT" | "GET", ttl: number, name?: string) {
  const payload = Buffer.from(JSON.stringify({ key, method, exp: Date.now() + ttl * 1000, name } satisfies LocalToken)).toString("base64url");
  return appUrl(`/api/uploads/local?token=${payload}.${sign(payload)}`);
}

export function verifyLocalToken(token: string | null, method: "PUT" | "GET"): LocalToken {
  const [payload, signature] = (token ?? "").split(".");
  if (!payload || !signature) throw badRequest("Invalid upload token.");
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw badRequest("Invalid upload token.");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as LocalToken;
  if (claims.method !== method || claims.exp < Date.now()) throw badRequest("Upload link expired.");
  return claims;
}

function localPath(key: string) {
  const resolved = path.resolve(LOCAL_ROOT, key);
  if (!resolved.startsWith(LOCAL_ROOT + path.sep)) throw badRequest("Invalid storage key.");
  return resolved;
}

export async function writeLocal(key: string, body: ArrayBuffer) {
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(body));
}

export async function readLocal(key: string) {
  return readFile(localPath(key));
}
