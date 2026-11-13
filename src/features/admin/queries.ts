import "server-only";

import { requireStaffUser, requireAdminUser } from "@/server/auth/session";
import { PROJECT_STATUS_LABELS, TASK_COLUMN_LABELS } from "@/server/domain";
import * as admin from "@/server/services/admin";
import { listServicesForAdmin } from "@/server/services/catalog";
import { adminGetPartner, adminListPartners } from "@/server/services/partners";
import { getSettings } from "@/server/services/settings";
import { adminDirectory, getProject, listStaff } from "@/server/services/projects";
import { listDeliverables } from "@/server/services/deliverables";
import { listDocuments } from "@/server/services/documents";
import { listMessages } from "@/server/services/messages";
import { getBoard } from "@/server/services/tasks";

/** Admin console queries: adapters over the server services, scoped to the signed-in staff member. */

export const PRIORITY_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", QA_REJECT: "QA Reject" };
export const HEALTH_LABELS: Record<string, string> = { ON_TRACK: "On Track", AT_RISK: "At Risk", DELAYED: "Delayed" };
/** Health and workflow status labels together (directory filters, badges). */
export const STATUS_LABELS: Record<string, string> = { ...HEALTH_LABELS, ...PROJECT_STATUS_LABELS };

export async function getAdminDashboard() {
  const user = await requireStaffUser();
  const data = await admin.adminDashboard(user);
  const { total, onTrack, atRisk, delayed } = data.projectStatus;
  const percent = (value: number) => (total ? Math.round((value / total) * 100) : 0);
  const trend = data.revenueTrend;
  const peak = trend ? trend.pointsPence.indexOf(Math.max(...trend.pointsPence)) : -1;

  return {
    stats: { ...data.stats, revenueMtd: data.stats.revenueMtdPence === null ? null : data.stats.revenueMtdPence / 100 },
    workload: data.workload,
    projectStatus: {
      total,
      segments: [
        { label: "On Track", value: percent(onTrack), color: "var(--color-brand)" },
        { label: "At Risk", value: percent(atRisk), color: "var(--color-navy)" },
        { label: "Delayed", value: percent(delayed), color: "#c4c4c4" },
      ],
    },
    revenueTrend: trend
      ? { months: trend.months, points: trend.pointsPence.map((value) => value / 100), highlightIndex: peak >= 0 ? peak : undefined }
      : null,
    priorityQueue: data.priorityQueue.map((item) => ({
      ...item,
      priorityLabel: PRIORITY_LABELS[item.priority] ?? item.priority,
    })),
  };
}

export async function getAdminProjects(params: Record<string, string>) {
  const user = await requireStaffUser();
  return adminDirectory(user, params);
}

export async function getStaffOptions() {
  await requireStaffUser();
  return listStaff();
}

const ROLE_NAMES: Record<string, string> = { CLIENT: "Client", ASSESSOR: "Assessor", DESIGNER: "Designer", COORDINATOR: "Coordinator", ADMIN: "Admin" };

/**
 * Everything the admin project page shows: the task board plus the project's workspace
 * (messages, every document version, deliverables, revision requests).
 */
export async function getProjectBoard(reference: string) {
  const user = await requireStaffUser();
  const [board, project] = await Promise.all([getBoard(user, reference), getProject(user, reference)]);
  const [documents, messages, deliverables] = await Promise.all([
    listDocuments(user, project.reference, { all: true }),
    listMessages(user, project.reference),
    listDeliverables(user, project.reference),
  ]);
  const base = `/api/projects/${encodeURIComponent(project.reference)}`;
  const person = (p: { name: string; role: string; avatarUrl: string | null; email?: string } | null) =>
    p ? { name: p.name, role: ROLE_NAMES[p.role] ?? p.role, email: p.email, avatar: p.avatarUrl ?? undefined } : { name: "Unknown", role: "" };

  return {
    board,
    project,
    columnLabels: TASK_COLUMN_LABELS,
    workspace: {
      me: { name: user.name, role: ROLE_NAMES[user.role] ?? user.role, avatar: user.avatarUrl ?? undefined },
      messages: messages.map((message) => ({ id: message.id, body: message.body, sentAt: message.sentAt, mine: message.mine, author: person(message.author) })),
      documents: documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        version: doc.version,
        sizeBytes: doc.sizeBytes,
        category: doc.category,
        uploadedAt: doc.uploadedAt,
        uploadedBy: doc.uploadedBy ? { name: doc.uploadedBy.name, isClient: doc.uploadedBy.role === "CLIENT" } : null,
        href: `${base}/documents/${doc.id}?download=1`,
      })),
      deliverables: deliverables.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        kind: item.kind,
        status: item.status,
        versioned: item.versioned,
        currentLabel: item.currentLabel,
        versions: item.versions.map((version: { number: number; label: string; note: string | null; at: string }) => ({ ...version, href: `${base}/deliverables/${item.id}/download?version=${version.number}` })),
      })),
      revisions: project.revisions,
      checklist: project.documentChecklist as Array<{ key: string; label: string; required: boolean; uploaded: boolean }>,
    },
  };
}
export type ProjectWorkspaceData = Awaited<ReturnType<typeof getProjectBoard>>["workspace"];

export async function getAdminServices() {
  await requireAdminUser();
  return listServicesForAdmin();
}

export async function getUsers(params: Record<string, string> = {}) {
  await requireAdminUser();
  return admin.listUsers(params);
}

export async function getIntegrations() {
  await requireAdminUser();
  return admin.integrationStatus();
}

export async function getEmailTemplates() {
  await requireAdminUser();
  return admin.listTemplates();
}

// ─── Partners ───────────────────────────────────────────────────────────────

export async function getPartners(params: { status?: string; q?: string } = {}) {
  await requireAdminUser();
  const all = await adminListPartners(params.q ? { q: params.q } : {});
  const counts = all.reduce<Record<string, number>>((acc, partner) => ({ ...acc, [partner.status]: (acc[partner.status] ?? 0) + 1 }), {});
  return { partners: params.status ? all.filter((partner) => params.status!.split(",").includes(partner.status)) : all, counts };
}

/** Partner detail with the services (for per-service discounts) and the allowed discount range. */
export async function getPartnerDetail(id: string) {
  await requireAdminUser();
  const [partner, services, settings] = await Promise.all([adminGetPartner(id), listServicesForAdmin(), getSettings()]);
  return {
    partner,
    services: services.map((service) => ({ id: service.id, code: service.code, title: service.title, active: service.active as boolean })),
    limits: {
      minPercent: settings.partner.minDiscountBps / 100,
      maxPercent: settings.partner.maxDiscountBps / 100,
      defaultPercent: settings.partner.defaultDiscountBps / 100,
      defaultCreditLimit: settings.partner.defaultCreditLimitPence === null ? null : settings.partner.defaultCreditLimitPence / 100,
      subscriptionPence: settings.partner.subscriptionPence,
    },
  };
}
