import "server-only";

import { requireStaffUser, requireAdminUser } from "@/server/auth/session";
import { PROJECT_STATUS_LABELS, TASK_COLUMN_LABELS } from "@/server/domain";
import * as admin from "@/server/services/admin";
import { listServicesForAdmin } from "@/server/services/catalog";
import { adminDirectory, getProject, listStaff } from "@/server/services/projects";
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

export async function getProjectBoard(reference: string) {
  const user = await requireStaffUser();
  const [board, project] = await Promise.all([getBoard(user, reference), getProject(user, reference)]);
  return { board, project, columnLabels: TASK_COLUMN_LABELS };
}

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
