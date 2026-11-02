import "server-only";

import { z } from "zod";

import { assertStaff, findAccessibleProject, projectScope } from "../auth/permissions";
import type { AuthUser } from "../auth/session";
import { db } from "../db";
import { badRequest, notFound } from "../errors";
import { DELIVERABLE_KINDS, DELIVERABLE_STATUSES } from "../domain";
import { createDownloadUrl } from "../integrations/storage";

/** Reports the team produces for the client (Deliverables tab). */

const toDeliverable = (item: any) => ({
  id: item.id as string,
  title: item.title as string,
  description: item.description as string,
  kind: item.kind as (typeof DELIVERABLE_KINDS)[number],
  status: item.status as (typeof DELIVERABLE_STATUSES)[number],
  documentId: (item.documentId as string | null) ?? null,
  estimatedAt: item.estimatedAt ? (item.estimatedAt as Date).toISOString() : null,
  availableAt: item.availableAt ? (item.availableAt as Date).toISOString() : null,
});
export type DeliverableDto = ReturnType<typeof toDeliverable>;

export const deliverableSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(400).default(""),
  kind: z.enum(DELIVERABLE_KINDS).default("PDF"),
  status: z.enum(DELIVERABLE_STATUSES).default("PENDING"),
  documentId: z.string().nullable().optional(),
  estimatedAt: z.coerce.date().nullable().optional(),
});
export const deliverablePatchSchema = deliverableSchema.partial();

export async function listDeliverables(user: AuthUser, reference: string) {
  const project = await findAccessibleProject(user, reference);
  const items = await db.deliverable.findMany({ where: { projectId: project.id }, orderBy: { createdAt: "asc" } });
  return items.map(toDeliverable);
}

async function assertDocumentOnProject(projectId: string, documentId: string | null | undefined) {
  if (!documentId) return;
  const doc = await db.document.findFirst({ where: { id: documentId, projectId, status: "ACTIVE" }, select: { id: true } });
  if (!doc) throw badRequest("Attach a document uploaded to this project.");
}

const availability = (status: string | undefined, documentId: string | null | undefined) => {
  if (status === "AVAILABLE" && !documentId) throw badRequest("Attach the document before marking a deliverable available.");
  return status === "AVAILABLE" ? { availableAt: new Date() } : status ? { availableAt: null } : {};
};

export async function createDeliverable(user: AuthUser, reference: string, input: z.input<typeof deliverableSchema>) {
  assertStaff(user);
  const data = deliverableSchema.parse(input);
  const project = await findAccessibleProject(user, reference);
  await assertDocumentOnProject(project.id, data.documentId);
  const item = await db.deliverable.create({ data: { projectId: project.id, ...data, ...availability(data.status, data.documentId) } });
  if (item.status === "AVAILABLE") {
    await db.activity.create({ data: { projectId: project.id, actorId: user.id, type: "deliverable.available", message: `${item.title} is ready` } });
  }
  return toDeliverable(item);
}

async function accessibleDeliverable(user: AuthUser, id: string) {
  const item = await db.deliverable.findFirst({ where: { id, project: projectScope(user) } });
  if (!item) throw notFound("Deliverable");
  return item;
}

export async function updateDeliverable(user: AuthUser, id: string, input: z.input<typeof deliverablePatchSchema>) {
  assertStaff(user);
  const data = deliverablePatchSchema.parse(input);
  const current = await accessibleDeliverable(user, id);
  const documentId = data.documentId !== undefined ? data.documentId : current.documentId;
  await assertDocumentOnProject(current.projectId, data.documentId);
  const item = await db.deliverable.update({ where: { id }, data: { ...data, ...availability(data.status, documentId) } });
  if (data.status === "AVAILABLE" && current.status !== "AVAILABLE") {
    await db.activity.create({ data: { projectId: current.projectId, actorId: user.id, type: "deliverable.available", message: `${item.title} is ready` } });
  }
  return toDeliverable(item);
}

export async function deleteDeliverable(user: AuthUser, id: string) {
  assertStaff(user);
  await accessibleDeliverable(user, id);
  await db.deliverable.delete({ where: { id } });
}

/** Signed download link for an available deliverable. */
export async function deliverableDownload(user: AuthUser, reference: string, id: string) {
  const project = await findAccessibleProject(user, reference);
  const item = await db.deliverable.findFirst({ where: { id, projectId: project.id }, include: { document: true } });
  if (!item || item.status !== "AVAILABLE" || !item.document) throw notFound("Deliverable");
  return createDownloadUrl(item.document.storageKey, item.document.fileName);
}
