import "server-only";

import { z } from "zod";

import { assertStaff, findAccessibleProject, isStaff, projectScope } from "../auth/permissions";
import type { AuthUser } from "../auth/session";
import { db } from "../db";
import { AppError, badRequest, notFound } from "../errors";
import { DELIVERABLE_KINDS, DELIVERABLE_STATUSES, DELIVERABLE_VERSION_LABELS } from "../domain";
import { createDownloadUrl } from "../integrations/storage";
import { activeHold } from "./workflow";

/**
 * Reports the team produces for the client (Deliverables tab). Created from the service's
 * deliverable list when the order is confirmed. Versioned ones go Initial → Revised → Final.
 * While the client's account is on hold, downloads are withheld (agreement clause 8).
 */

const toDeliverable = (item: any) => ({
  id: item.id as string,
  title: item.title as string,
  description: item.description as string,
  kind: item.kind as (typeof DELIVERABLE_KINDS)[number],
  status: item.status as (typeof DELIVERABLE_STATUSES)[number],
  versioned: item.versioned as boolean,
  currentLabel: (item.currentLabel as (typeof DELIVERABLE_VERSION_LABELS)[number] | null) ?? null,
  documentId: (item.documentId as string | null) ?? null,
  estimatedAt: item.estimatedAt ? (item.estimatedAt as Date).toISOString() : null,
  availableAt: item.availableAt ? (item.availableAt as Date).toISOString() : null,
  versions: (item.versions ?? []).map((version: any) => ({
    number: version.number as number,
    label: version.label as string,
    documentId: version.documentId as string,
    note: (version.note as string | null) ?? null,
    at: (version.createdAt as Date).toISOString(),
  })),
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
  const items = await db.deliverable.findMany({ where: { projectId: project.id }, include: { versions: { orderBy: { number: "asc" } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
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

export const versionSchema = z.object({
  documentId: z.string().min(1),
  /** Defaults to INITIAL for the first issue and REVISED after that. */
  label: z.enum(DELIVERABLE_VERSION_LABELS).optional(),
  note: z.string().trim().max(400).optional(),
});

/** Staff issue a new version of a deliverable (a document already uploaded to the project). */
export async function addDeliverableVersion(user: AuthUser, id: string, input: z.input<typeof versionSchema>) {
  assertStaff(user);
  const data = versionSchema.parse(input);
  const item = await accessibleDeliverable(user, id);
  await assertDocumentOnProject(item.projectId, data.documentId);
  const count = await db.deliverableVersion.count({ where: { deliverableId: id } });
  const label = data.label ?? (count === 0 ? "INITIAL" : "REVISED");
  if (!item.versioned && count > 0 && label !== "FINAL") throw badRequest("This deliverable isn't versioned; issue it as FINAL.");
  const updated = await db.$transaction(async (tx) => {
    await tx.deliverableVersion.create({ data: { deliverableId: id, number: count + 1, label, documentId: data.documentId, note: data.note ?? null, createdById: user.id } });
    await tx.activity.create({ data: { projectId: item.projectId, actorId: user.id, type: "deliverable.version", message: `${item.title}: ${label.toLowerCase()} version issued` } });
    return tx.deliverable.update({
      where: { id },
      data: { documentId: data.documentId, currentLabel: label, status: "AVAILABLE", availableAt: new Date() },
      include: { versions: { orderBy: { number: "asc" } } },
    });
  });
  return toDeliverable(updated);
}

/** Signed download link for an available deliverable (latest version, or a given one). */
export async function deliverableDownload(user: AuthUser, reference: string, id: string, versionNumber?: number) {
  const project = await findAccessibleProject(user, reference);
  if (!isStaff(user) && (await activeHold(project.clientId))) {
    throw new AppError("LOCKED", "Downloads are paused while the account is on hold. Please settle the overdue invoice.");
  }
  const item = await db.deliverable.findFirst({ where: { id, projectId: project.id }, include: { document: true, versions: { include: { document: true } } } });
  if (!item || item.status !== "AVAILABLE") throw notFound("Deliverable");
  const document = versionNumber ? item.versions.find((version: any) => version.number === versionNumber)?.document : item.document;
  if (!document) throw notFound("Deliverable");
  return createDownloadUrl(document.storageKey, document.fileName);
}
