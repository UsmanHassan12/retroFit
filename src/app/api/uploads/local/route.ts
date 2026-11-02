import { notFound } from "@/server/errors";
import { integrations } from "@/server/env";
import { handle, noContent } from "@/server/http";
import { readLocal, verifyLocalToken, writeLocal } from "@/server/integrations/storage";

/**
 * Development stand-in for S3 presigned URLs (only active when S3_BUCKET is unset).
 * The HMAC token in ?token= authorises exactly one key and method until it expires.
 */
export const PUT = handle(async (request) => {
  if (integrations.s3()) throw notFound();
  const claims = verifyLocalToken(new URL(request.url).searchParams.get("token"), "PUT");
  await writeLocal(claims.key, await request.arrayBuffer());
  return noContent();
});

export const GET = handle(async (request) => {
  if (integrations.s3()) throw notFound();
  const claims = verifyLocalToken(new URL(request.url).searchParams.get("token"), "GET");
  const body = await readLocal(claims.key).catch(() => null);
  if (!body) throw notFound("File");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${(claims.name ?? "download").replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
