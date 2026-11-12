import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { findAccessibleProject, isStaff } from "../auth/permissions";
import type { AuthUser } from "../auth/session";
import { db } from "../db";
import { AppError, badRequest, forbidden, notFound } from "../errors";
import { FILE_TYPE_ALIASES, UPLOAD_RULES } from "../domain";
import { createDownloadUrl, createUploadUrl, deleteObject, objectSize } from "../integrations/storage";
import { toPerson } from "./projects";
import { refreshProject } from "./workflow";

/**
 * Project documents (Task & Docs tab). Upload is a three-step handshake so file bytes never
 * pass through the app server:
 *   1. POST   /documents            → PENDING row + presigned PUT URL
 *   2. PUT    <uploadUrl>           (browser → S3)
 *   3. POST   /documents/:id/confirm → verify the object exists, mark ACTIVE
 * Re-uploading a file with the same name creates the next version.
 * An upload can satisfy one of the service's required documents (`requirementKey`); when the
 * last required one arrives, an AWAITING_INFO project moves on by itself.
 */

export const requestUploadSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .refine((name) => !/[\\/]/.test(name), "File names can't contain slashes."),
  mimeType: z.enum(UPLOAD_RULES.mimeTypes as [string, ...string[]], { message: "Upload a PDF, JPG, PNG, DOCX or XLSX file." }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(UPLOAD_RULES.maxBytes, `Files must be ${UPLOAD_RULES.maxBytes / 1024 / 1024}MB or smaller.`),
  category: z.string().trim().max(60).optional(),
  requirementKey: z.string().trim().max(60).optional(),
});

const docInclude = { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true } } } as const;

const toDocument = (doc: any) => ({
  id: doc.id as string,
  fileName: doc.fileName as string,
  mimeType: doc.mimeType as string,
  sizeBytes: doc.sizeBytes as number,
  version: doc.version as number,
  category: (doc.category as string | null) ?? null,
  requirementKey: (doc.requirementKey as string | null) ?? null,
  status: doc.status as string,
  uploadedBy: toPerson(doc.uploadedBy),
  uploadedAt: (doc.createdAt as Date).toISOString(),
});
export type DocumentDto = ReturnType<typeof toDocument>;

/** Latest active version of each file, newest first. `all=true` returns every version. */
export async function listDocuments(user: AuthUser, reference: string, { all = false } = {}) {
  const project = await findAccessibleProject(user, reference);
  const docs = await db.document.findMany({
    where: { projectId: project.id, status: "ACTIVE" },
    include: docInclude,
    orderBy: [{ createdAt: "desc" }, { version: "desc" }],
  });
  if (all) return docs.map(toDocument);
  const latest = new Map<string, any>();
  for (const doc of docs) {
    const current = latest.get(doc.fileName);
    if (!current || doc.version > current.version) latest.set(doc.fileName, doc);
  }
  return [...latest.values()].sort((a, b) => b.createdAt - a.createdAt).map(toDocument);
}

export async function requestUpload(user: AuthUser, reference: string, input: z.input<typeof requestUploadSchema>) {
  const data = requestUploadSchema.parse(input);
  const project = await findAccessibleProject(user, reference);
  let category = data.category;
  if (data.requirementKey) {
    const full = await db.project.findUnique({ where: { id: project.id }, select: { serviceId: true } });
    const requirement = await db.serviceDocumentRequirement.findUnique({ where: { serviceId_key: { serviceId: full!.serviceId, key: data.requirementKey } } });
    if (!requirement) throw badRequest("That document isn't on this service's list.");
    const accepted = requirement.acceptedTypes.map((type: string) => FILE_TYPE_ALIASES[type.toUpperCase()] ?? type);
    if (accepted.length && !accepted.includes(data.mimeType)) throw badRequest(`${requirement.label}: upload ${requirement.acceptedTypes.join(", ")}.`);
    if (data.sizeBytes > requirement.maxBytes) throw badRequest(`${requirement.label}: files must be ${Math.round(requirement.maxBytes / 1024 / 1024)}MB or smaller.`);
    category ??= requirement.label;
  }
  const latest = await db.document.findFirst({
    where: { projectId: project.id, fileName: data.fileName, status: "ACTIVE" },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const id = randomUUID();
  const safeName = data.fileName.replace(/[^\w.\- ]+/g, "_");
  const storageKey = `projects/${project.id}/${id}/${safeName}`;

  const document = await db.document.create({
    data: {
      projectId: project.id,
      uploadedById: user.id,
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      storageKey,
      version: (latest?.version ?? 0) + 1,
      category,
      requirementKey: data.requirementKey ?? null,
      status: "PENDING",
    },
    include: docInclude,
  });
  const upload = await createUploadUrl(storageKey, data.mimeType);
  return { document: toDocument(document), upload };
}

async function accessibleDocument(user: AuthUser, reference: string, documentId: string) {
  const project = await findAccessibleProject(user, reference);
  const document = await db.document.findFirst({ where: { id: documentId, projectId: project.id }, include: docInclude });
  if (!document) throw notFound("Document");
  return { project, document };
}

export async function confirmUpload(user: AuthUser, reference: string, documentId: string) {
  const { project, document } = await accessibleDocument(user, reference, documentId);
  if (document.uploadedById !== user.id) throw forbidden();
  if (document.status === "ACTIVE") return toDocument(document);

  const size = await objectSize(document.storageKey);
  if (size === null) throw badRequest("The file hasn't finished uploading yet.");
  if (size > UPLOAD_RULES.maxBytes) {
    await deleteObject(document.storageKey);
    await db.document.delete({ where: { id: document.id } });
    throw new AppError("VALIDATION_FAILED", `Files must be ${UPLOAD_RULES.maxBytes / 1024 / 1024}MB or smaller.`);
  }

  const confirmed = await db.$transaction(async (tx) => {
    const saved = await tx.document.update({ where: { id: document.id }, data: { status: "ACTIVE", sizeBytes: size }, include: docInclude });
    await tx.activity.create({
      data: {
        projectId: project.id,
        actorId: user.id,
        type: "document.uploaded",
        message: document.version > 1 ? `${document.fileName} updated to v${document.version}` : `${document.fileName} uploaded`,
      },
    });
    if (document.requirementKey) await refreshProject(tx, project.id, { actorId: user.id });
    return saved;
  });
  return toDocument(confirmed);
}

export async function getDocument(user: AuthUser, reference: string, documentId: string) {
  const { document } = await accessibleDocument(user, reference, documentId);
  if (document.status !== "ACTIVE") throw notFound("Document");
  return { ...toDocument(document), downloadUrl: await createDownloadUrl(document.storageKey, document.fileName) };
}

/** Uploader or project staff may delete. */
export async function deleteDocument(user: AuthUser, reference: string, documentId: string) {
  const { project, document } = await accessibleDocument(user, reference, documentId);
  if (document.uploadedById !== user.id && !isStaff(user)) throw forbidden("You can only delete documents you uploaded.");
  await db.$transaction(async (tx) => {
    await tx.document.delete({ where: { id: document.id } });
    await tx.activity.create({ data: { projectId: project.id, actorId: user.id, type: "document.deleted", message: `${document.fileName} v${document.version} deleted` } });
    if (document.requirementKey) await refreshProject(tx, project.id, { actorId: user.id });
  });
  await deleteObject(document.storageKey);
}

/** Stale PENDING uploads (never confirmed) older than a day can be purged by a cron. */
export async function purgeAbandonedUploads() {
  const stale = await db.document.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 86_400_000) } }, select: { id: true, storageKey: true } });
  for (const doc of stale) {
    await deleteObject(doc.storageKey);
    await db.document.delete({ where: { id: doc.id } });
  }
  return stale.length;
}
