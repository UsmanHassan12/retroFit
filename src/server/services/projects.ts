import "server-only";

import { z } from "zod";

import { assertCanManageTeam, assertStaff, findAccessibleProject, isStaff, projectScope } from "../auth/permissions";
import { displayName, type AuthUser } from "../auth/session";
import { db } from "../db";
import { appUrl } from "../env";
import { AppError, badRequest } from "../errors";
import {
  PHASE_LABELS,
  PRIORITIES,
  PROJECT_PHASES,
  PROJECT_STATUSES,
  phaseProgress,
  type ProjectPhase,
  type ProjectStatus,
} from "../domain";
import { sendTemplate } from "../integrations/email";

// ─── Shapes ─────────────────────────────────────────────────────────────────

const personSelect = { id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true } as const;

export function toPerson(user: any) {
  if (!user) return null;
  return {
    id: user.id as string,
    name: displayName(user),
    email: user.email as string,
    role: user.role as string,
    avatarUrl: (user.avatarUrl as string | null) ?? null,
  };
}
export type PersonDto = NonNullable<ReturnType<typeof toPerson>>;

const summaryInclude = {
  property: true,
  service: { select: { slug: true, title: true, imageUrl: true } },
  coordinator: { select: personSelect },
  client: { select: personSelect },
  members: { include: { user: { select: personSelect } } },
} as const;

function toProjectSummary(project: any) {
  return {
    id: project.id as string,
    reference: project.reference as string,
    title: project.title as string,
    imageUrl: ((project.coverImageUrl as string | null) ?? project.service.imageUrl) as string,
    service: { slug: project.service.slug as string, title: project.service.title as string, imageUrl: project.service.imageUrl as string },
    property: project.property
      ? {
          id: project.property.id as string,
          line1: project.property.line1 as string,
          city: project.property.city as string,
          postcode: project.property.postcode as string,
          verified: project.property.verified as boolean,
        }
      : null,
    phase: project.phase as ProjectPhase,
    phaseLabel: PHASE_LABELS[project.phase as ProjectPhase],
    status: project.status as string,
    priority: project.priority as string,
    progress: project.progress as number,
    scheme: (project.scheme as string | null) ?? null,
    fundingSecuredPence: project.fundingSecuredPence as number,
    compliancePercent: project.compliancePercent as number,
    hasIssues: project.hasIssues as boolean,
    criticalIssue: project.criticalIssue as boolean,
    issueSummary: (project.issueSummary as string | null) ?? null,
    dueDate: project.dueDate ? (project.dueDate as Date).toISOString() : null,
    client: toPerson(project.client),
    coordinator: toPerson(project.coordinator),
    team: (project.members ?? []).map((member: any) => toPerson(member.user)!),
    createdAt: (project.createdAt as Date).toISOString(),
    updatedAt: (project.updatedAt as Date).toISOString(),
  };
}
export type ProjectSummaryDto = ReturnType<typeof toProjectSummary>;

const ACTIVE = { status: { notIn: ["COMPLETED", "CANCELLED"] as ProjectStatus[] } };
const DONE = { status: "COMPLETED" as const };

// ─── Client & shared reads ──────────────────────────────────────────────────

export const projectListSchema = z.object({
  status: z.enum(["all", "active", "completed"]).default("all"),
  q: z.string().trim().max(100).optional(),
});

function searchWhere(q: string | undefined) {
  if (!q) return {};
  return {
    OR: [
      { reference: { contains: q, mode: "insensitive" as const } },
      { title: { contains: q, mode: "insensitive" as const } },
      { property: { line1: { contains: q, mode: "insensitive" as const } } },
      { property: { city: { contains: q, mode: "insensitive" as const } } },
      { property: { postcode: { contains: q, mode: "insensitive" as const } } },
      { client: { email: { contains: q, mode: "insensitive" as const } } },
    ],
  };
}

export async function listProjects(user: AuthUser, input: z.input<typeof projectListSchema> | Record<string, string> = {}) {
  const filters = projectListSchema.parse(input);
  const projects = await db.project.findMany({
    where: {
      AND: [
        projectScope(user),
        filters.status === "active" ? ACTIVE : filters.status === "completed" ? DONE : {},
        searchWhere(filters.q),
      ],
    },
    include: summaryInclude,
    orderBy: [{ updatedAt: "desc" }],
  });
  return projects.map(toProjectSummary);
}

export async function getProject(user: AuthUser, reference: string) {
  const { id } = await findAccessibleProject(user, reference);
  const project = await db.project.findUnique({
    where: { id },
    include: {
      ...summaryInclude,
      milestones: { orderBy: { position: "asc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: personSelect } } },
    },
  });
  return {
    ...toProjectSummary(project),
    phaseDescription: (project.phaseDescription as string | null) ?? null,
    phaseNotice: (project.phaseNotice as string | null) ?? null,
    milestones: project.milestones.map(toMilestone),
    activity: project.activities.map(toActivity),
  };
}
export type ProjectDetailDto = Awaited<ReturnType<typeof getProject>>;

const toMilestone = (milestone: any) => ({
  phase: milestone.phase as ProjectPhase,
  title: milestone.title as string,
  status: milestone.status as "DONE" | "CURRENT" | "UPCOMING",
  completedAt: milestone.completedAt ? (milestone.completedAt as Date).toISOString() : null,
});

const toActivity = (activity: any) => ({
  id: activity.id as string,
  type: activity.type as string,
  message: activity.message as string,
  actor: toPerson(activity.actor),
  at: (activity.createdAt as Date).toISOString(),
});

export async function getTimeline(user: AuthUser, reference: string) {
  const { id } = await findAccessibleProject(user, reference);
  const [milestones, activities] = await Promise.all([
    db.projectMilestone.findMany({ where: { projectId: id }, orderBy: { position: "asc" } }),
    db.activity.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: personSelect } } }),
  ]);
  return { milestones: milestones.map(toMilestone), activity: activities.map(toActivity) };
}

/** Client dashboard numbers. */
export async function clientDashboard(user: AuthUser) {
  const scope = projectScope(user);
  const [active, completedCount, funding, compliance, activity] = await Promise.all([
    db.project.findMany({ where: { AND: [scope, ACTIVE] }, include: summaryInclude, orderBy: { updatedAt: "desc" } }),
    db.project.count({ where: { AND: [scope, DONE] } }),
    db.project.aggregate({ where: scope, _sum: { fundingSecuredPence: true } }),
    db.project.aggregate({ where: { AND: [scope, { status: { not: "CANCELLED" } }] }, _avg: { compliancePercent: true } }),
    db.activity.findMany({
      where: { project: scope },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: personSelect } },
    }),
  ]);
  return {
    stats: {
      activeProjects: active.length,
      completedProjects: completedCount,
      fundingSecuredPence: (funding._sum.fundingSecuredPence as number | null) ?? 0,
      compliancePercent: Math.round((compliance._avg.compliancePercent as number | null) ?? 100),
    },
    activeProjects: active.map(toProjectSummary),
    activity: activity.map(toActivity),
  };
}

// ─── Staff ──────────────────────────────────────────────────────────────────

export const adminProjectFiltersSchema = z.object({
  status: z.enum(["all", "active", "completed", ...PROJECT_STATUSES]).default("all"),
  assignedTo: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  hasIssues: z.enum(["true", "false"]).optional(),
  criticalOnly: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export async function adminDirectory(user: AuthUser, input: z.input<typeof adminProjectFiltersSchema> | Record<string, string> = {}) {
  assertStaff(user);
  const filters = adminProjectFiltersSchema.parse(input);
  const statusWhere =
    filters.status === "all" ? {} : filters.status === "active" ? ACTIVE : filters.status === "completed" ? DONE : { status: filters.status };
  const where = {
    AND: [
      projectScope(user),
      statusWhere,
      filters.assignedTo
        ? { OR: [{ coordinatorId: filters.assignedTo }, { members: { some: { userId: filters.assignedTo } } }] }
        : {},
      filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {},
      filters.hasIssues === "true" ? { hasIssues: true } : {},
      filters.criticalOnly === "true" ? { criticalIssue: true } : {},
      searchWhere(filters.q),
    ],
  };
  const [total, projects] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      include: summaryInclude,
      orderBy: [{ criticalIssue: "desc" }, { dueDate: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return { total, page: filters.page, pageSize: filters.pageSize, projects: projects.map(toProjectSummary) };
}

export const updateProjectSchema = z
  .object({
    phase: z.enum(PROJECT_PHASES),
    status: z.enum(PROJECT_STATUSES),
    priority: z.enum(PRIORITIES),
    progress: z.number().int().min(0).max(100),
    phaseDescription: z.string().trim().max(500).nullable(),
    phaseNotice: z.string().trim().max(300).nullable(),
    dueDate: z.coerce.date().nullable(),
    hasIssues: z.boolean(),
    criticalIssue: z.boolean(),
    issueSummary: z.string().trim().max(200).nullable(),
    fundingSecuredPence: z.number().int().min(0),
    compliancePercent: z.number().int().min(0).max(100),
    coordinatorId: z.string().nullable(),
    memberIds: z.array(z.string()).max(20),
  })
  .partial();

export async function updateProject(user: AuthUser, reference: string, input: z.input<typeof updateProjectSchema>) {
  assertStaff(user);
  const data = updateProjectSchema.parse(input);
  const current = await findAccessibleProject(user, reference);
  const { memberIds, coordinatorId, phase, ...fields } = data;

  if (memberIds !== undefined || coordinatorId !== undefined) {
    assertCanManageTeam(user);
    const ids = [...(memberIds ?? []), ...(coordinatorId ? [coordinatorId] : [])];
    const staff = await db.user.count({ where: { id: { in: ids }, role: { not: "CLIENT" }, status: "ACTIVE" } });
    if (staff !== new Set(ids).size) throw badRequest("Team members must be active staff.");
    if (coordinatorId) {
      const coordinator = await db.user.findUnique({ where: { id: coordinatorId }, select: { role: true } });
      if (coordinator?.role !== "COORDINATOR" && coordinator?.role !== "ADMIN") throw badRequest("Choose a coordinator.");
    }
  }

  const phaseChanged = phase !== undefined && phase !== current.phase;
  const updated = await db.$transaction(async (tx) => {
    if (phaseChanged) {
      const index = PROJECT_PHASES.indexOf(phase);
      for (const [position, item] of PROJECT_PHASES.entries()) {
        const status = position < index || phase === "COMPLETED" ? "DONE" : position === index ? "CURRENT" : "UPCOMING";
        await tx.projectMilestone.upsert({
          where: { projectId_phase: { projectId: current.id, phase: item } },
          create: { projectId: current.id, phase: item, title: PHASE_LABELS[item], position, status, completedAt: status === "DONE" ? new Date() : null },
          update: { status, ...(status === "DONE" ? {} : { completedAt: null }) },
        });
      }
      await tx.projectMilestone.updateMany({ where: { projectId: current.id, status: "DONE", completedAt: null }, data: { completedAt: new Date() } });
      await tx.activity.create({
        data: { projectId: current.id, actorId: user.id, type: "phase.changed", message: `Moved to ${PHASE_LABELS[phase]}` },
      });
    }
    if (memberIds !== undefined) {
      await tx.projectMember.deleteMany({ where: { projectId: current.id, userId: { notIn: memberIds } } });
      await tx.projectMember.createMany({ data: memberIds.map((userId) => ({ projectId: current.id, userId })), skipDuplicates: true });
    }
    if (coordinatorId) {
      await tx.projectMember.createMany({ data: [{ projectId: current.id, userId: coordinatorId }], skipDuplicates: true });
    }
    return tx.project.update({
      where: { id: current.id },
      data: {
        ...fields,
        ...(coordinatorId !== undefined ? { coordinatorId } : {}),
        ...(phaseChanged
          ? {
              phase,
              progress: fields.progress ?? phaseProgress(phase),
              ...(phase === "COMPLETED" ? { status: "COMPLETED" as const, completedAt: new Date() } : {}),
            }
          : {}),
      },
      include: { ...summaryInclude },
    });
  });

  if (phaseChanged && updated.client) {
    await sendTemplate("project_update", updated.client.email, {
      user_name: displayName(updated.client),
      project_name: updated.title,
      project_ref: updated.reference,
      phase: PHASE_LABELS[phase],
      link: appUrl(`/dashboard/projects/${updated.reference}`),
    });
  }
  return toProjectSummary(updated);
}

/** Staff list for assignment pickers and filters. */
export async function listStaff() {
  const staff = await db.user.findMany({
    where: { role: { not: "CLIENT" }, status: "ACTIVE" },
    select: personSelect,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return staff.map((user: any) => toPerson(user)!);
}

export function assertProjectWritable(user: AuthUser) {
  if (!isStaff(user)) throw new AppError("FORBIDDEN", "Only the project team can do that.");
}
