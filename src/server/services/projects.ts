import "server-only";

import { z } from "zod";

import { assertCanManageTeam, assertStaff, findAccessibleProject, isStaff, projectScope } from "../auth/permissions";
import { displayName, type AuthUser } from "../auth/session";
import { db } from "../db";
import { appUrl, integrations } from "../env";
import { AppError, badRequest, conflict, notFound } from "../errors";
import {
  CLOSED_PROJECT_STATUSES,
  PRIORITIES,
  PROJECT_HEALTH,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type ProjectStatus,
} from "../domain";
import { sendTemplate } from "../integrations/email";
import { requireStripe } from "../integrations/stripe";
import { cancellationPercent } from "../rules/workflow";
import { formatPence } from "../rules/pricing";
import { audit } from "./audit";
import { addCreditEntry } from "./credit";
import { checkAnswers, commonQuestions, intakeFacts, serviceQuestions } from "./intake";
import { issueInvoice } from "./invoices";
import { getSettings } from "./settings";
import { addActivity, projectState, refreshProject, releaseSlot, setCurrentMilestone, transitionProject } from "./workflow";

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
  service: { select: { slug: true, code: true, title: true, imageUrl: true, siteVisit: true, category: true } },
  coordinator: { select: personSelect },
  client: { select: { ...personSelect, companyName: true } },
  members: { include: { user: { select: personSelect } } },
  milestones: { orderBy: { position: "asc" as const } },
} as const;

function currentMilestone(project: any) {
  const milestones = (project.milestones ?? []) as any[];
  return milestones.find((milestone) => milestone.status === "CURRENT") ?? [...milestones].reverse().find((milestone) => milestone.status === "DONE") ?? null;
}

function toProjectSummary(project: any) {
  const stage = currentMilestone(project);
  const status = project.status as ProjectStatus;
  return {
    id: project.id as string,
    reference: project.reference as string,
    title: project.title as string,
    imageUrl: ((project.coverImageUrl as string | null) ?? project.service.imageUrl) as string,
    service: { slug: project.service.slug as string, code: project.service.code as string, title: project.service.title as string, imageUrl: project.service.imageUrl as string, category: project.service.category as string },
    property: project.property
      ? {
          id: project.property.id as string,
          line1: project.property.line1 as string,
          city: project.property.city as string,
          postcode: project.property.postcode as string,
          verified: project.property.verified as boolean,
        }
      : null,
    status,
    statusLabel: PROJECT_STATUS_LABELS[status],
    health: project.health as string,
    /** Current workflow stage (the service's own stage names). */
    stage: stage ? { position: stage.position as number, name: stage.title as string } : null,
    /** Kept for screens that show "phase": the current stage name. */
    phaseLabel: stage ? (stage.title as string) : PROJECT_STATUS_LABELS[status],
    priority: project.priority as string,
    partnerPriority: project.partnerPriority as boolean,
    progress: project.progress as number,
    fastTrack: project.fastTrack as boolean,
    scheme: (project.scheme as string | null) ?? null,
    fundingSecuredPence: project.fundingSecuredPence as number,
    compliancePercent: project.compliancePercent as number,
    hasIssues: project.hasIssues as boolean,
    criticalIssue: project.criticalIssue as boolean,
    issueSummary: (project.issueSummary as string | null) ?? null,
    dueDate: project.dueDate ? (project.dueDate as Date).toISOString() : null,
    client: toPerson(project.client),
    clientCompany: (project.client?.companyName as string | null) ?? null,
    coordinator: toPerson(project.coordinator),
    team: (project.members ?? []).map((member: any) => toPerson(member.user)!),
    createdAt: (project.createdAt as Date).toISOString(),
    updatedAt: (project.updatedAt as Date).toISOString(),
  };
}
export type ProjectSummaryDto = ReturnType<typeof toProjectSummary>;

const ACTIVE = { status: { notIn: [...CLOSED_PROJECT_STATUSES] as ProjectStatus[] } };
const DONE = { status: "COMPLETED" as const };

const toMilestone = (milestone: any) => ({
  position: milestone.position as number,
  title: milestone.title as string,
  description: milestone.description as string,
  status: milestone.status as "DONE" | "CURRENT" | "UPCOMING",
  clientVisible: milestone.clientVisible as boolean,
  dueAt: milestone.dueAt ? (milestone.dueAt as Date).toISOString() : null,
  completedAt: milestone.completedAt ? (milestone.completedAt as Date).toISOString() : null,
});

const toActivity = (activity: any) => ({
  id: activity.id as string,
  type: activity.type as string,
  message: activity.message as string,
  actor: toPerson(activity.actor),
  at: (activity.createdAt as Date).toISOString(),
});

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
      { client: { companyName: { contains: q, mode: "insensitive" as const } } },
    ],
  };
}

export async function listProjects(user: AuthUser, input: z.input<typeof projectListSchema> | Record<string, string> = {}) {
  const filters = projectListSchema.parse(input);
  const projects = await db.project.findMany({
    where: { AND: [projectScope(user), filters.status === "active" ? ACTIVE : filters.status === "completed" ? DONE : {}, searchWhere(filters.q)] },
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
      activities: { orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: personSelect } } },
      revisions: { orderBy: { createdAt: "desc" } },
    },
  });
  const state = await projectState(db, id);
  const staff = isStaff(user);
  const stage = currentMilestone(project);
  return {
    ...toProjectSummary(project),
    phaseDescription: (project.phaseDescription as string | null) ?? (stage?.description as string | undefined) ?? null,
    phaseNotice: (project.phaseNotice as string | null) ?? null,
    turnaroundDays: (project.turnaroundDays as number | null) ?? null,
    clockStartAt: project.clockStartAt ? (project.clockStartAt as Date).toISOString() : null,
    revisions: { included: project.revisionRoundsIncluded as number, used: project.revisionRoundsUsed as number, requests: project.revisions.map((item: any) => ({ id: item.id as string, round: item.round as number, note: item.note as string, billable: item.billable as boolean, pricePence: (item.pricePence as number | null) ?? null, status: item.status as string, at: (item.createdAt as Date).toISOString() })) },
    /** What's still needed from the client (AWAITING_INFO). */
    missing: { answers: state.missingAnswers, documents: state.missingDocuments.map((doc: any) => ({ key: doc.key as string, label: doc.label as string })) },
    documentChecklist: state.documents,
    nextVisit: state.nextVisit ? { date: state.nextVisit.date.toISOString().slice(0, 10), window: state.nextVisit.window } : null,
    milestones: project.milestones.filter((milestone: any) => staff || milestone.clientVisible).map(toMilestone),
    activity: project.activities.map(toActivity),
  };
}
export type ProjectDetailDto = Awaited<ReturnType<typeof getProject>>;

export async function getTimeline(user: AuthUser, reference: string) {
  const { id } = await findAccessibleProject(user, reference);
  const [milestones, activities] = await Promise.all([
    db.projectMilestone.findMany({ where: { projectId: id, ...(isStaff(user) ? {} : { clientVisible: true }) }, orderBy: { position: "asc" } }),
    db.activity.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: personSelect } } }),
  ]);
  return { milestones: milestones.map(toMilestone), activity: activities.map(toActivity) };
}

/** GET /api/projects/:ref/requirements — intake answers and documents still needed. */
export async function getRequirements(user: AuthUser, reference: string) {
  const { id } = await findAccessibleProject(user, reference);
  const state = await projectState(db, id);
  return {
    status: state.project.status as string,
    intakeComplete: state.intakeComplete,
    documentsComplete: state.documentsComplete,
    missingAnswers: state.missingAnswers,
    documents: state.documents,
    needsVisit: state.needsVisit,
    visitBooked: state.visitBooked,
  };
}

export const intakeUpdateSchema = z.object({
  /** Common ORDER-scope answers (shared by every project in the order). */
  orderAnswers: z.record(z.string(), z.unknown()).optional(),
  /** This project's own answers. */
  answers: z.record(z.string(), z.unknown()).optional(),
});

/** Client (or staff) completes missing intake answers; the project moves on when ready. */
export async function updateIntake(user: AuthUser, reference: string, input: z.input<typeof intakeUpdateSchema>) {
  const data = intakeUpdateSchema.parse(input);
  const { id } = await findAccessibleProject(user, reference);
  const project = await db.project.findUnique({ where: { id }, include: { orderLine: { include: { order: { include: { lines: { select: { serviceCode: true } } } } } }, client: true, property: true } });
  if (!project?.orderLine) throw badRequest("This project has no booking to update.");
  if (["COMPLETED", "CANCELLED"].includes(project.status)) throw conflict("This project is closed.");
  const order = project.orderLine.order;
  const facts = intakeFacts({ tier: order.customerTier as never, serviceCodes: order.lines.map((line: any) => line.serviceCode), customerType: project.client.customerType, tenure: project.property?.tenure });
  const common = await commonQuestions();
  const perService = await serviceQuestions([project.serviceId]);

  const orderAnswers = { ...(order.answers as Record<string, unknown>), ...(data.orderAnswers ?? {}) };
  const orderCheck = checkAnswers(common.filter((question) => question.scope === "ORDER"), orderAnswers, facts);
  const lineAnswers = { ...(project.orderLine.answers as Record<string, unknown>), ...(data.answers ?? {}) };
  const lineCheck = checkAnswers([...common.filter((question) => question.scope === "LINE"), ...(perService.get(project.serviceId) ?? [])], lineAnswers, { ...facts, ...orderCheck.answers });

  await db.$transaction(async (tx) => {
    if (data.orderAnswers) await tx.order.update({ where: { id: order.id }, data: { answers: orderCheck.answers as never } });
    if (data.answers) await tx.orderLine.update({ where: { id: project.orderLine!.id }, data: { answers: lineCheck.answers as never } });
    await addActivity(tx, id, user.id, "intake.updated", "Booking details updated");
    // Other projects in the same order share the ORDER answers.
    const siblings = data.orderAnswers ? await tx.project.findMany({ where: { orderId: order.id }, select: { id: true } }) : [{ id }];
    for (const sibling of siblings) await refreshProject(tx, sibling.id, { actorId: user.id });
  });
  return getRequirements(user, reference);
}

/** Client dashboard numbers. */
export async function clientDashboard(user: AuthUser) {
  const scope = projectScope(user);
  const [active, completedCount, funding, compliance, activity, waiting] = await Promise.all([
    db.project.findMany({ where: { AND: [scope, ACTIVE] }, include: summaryInclude, orderBy: { updatedAt: "desc" } }),
    db.project.count({ where: { AND: [scope, DONE] } }),
    db.project.aggregate({ where: scope, _sum: { fundingSecuredPence: true } }),
    db.project.aggregate({ where: { AND: [scope, { status: { not: "CANCELLED" } }] }, _avg: { compliancePercent: true } }),
    db.activity.findMany({ where: { project: scope }, orderBy: { createdAt: "desc" }, take: 5, include: { actor: { select: personSelect } } }),
    db.project.count({ where: { AND: [scope, { status: "AWAITING_INFO" }] } }),
  ]);
  return {
    stats: {
      activeProjects: active.length,
      completedProjects: completedCount,
      awaitingInfo: waiting,
      fundingSecuredPence: (funding._sum.fundingSecuredPence as number | null) ?? 0,
      compliancePercent: Math.round((compliance._avg.compliancePercent as number | null) ?? 100),
    },
    activeProjects: active.map(toProjectSummary),
    activity: activity.map(toActivity),
  };
}

// ─── Staff ──────────────────────────────────────────────────────────────────

export const adminProjectFiltersSchema = z.object({
  /** all / active / completed, a workflow status, or a health value (ON_TRACK, AT_RISK, DELAYED). */
  status: z.enum(["all", "active", "completed", ...PROJECT_STATUSES, ...PROJECT_HEALTH]).default("all"),
  assignedTo: z.string().trim().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  hasIssues: z.enum(["true", "false"]).optional(),
  criticalOnly: z.enum(["true", "false"]).optional(),
  partnerOnly: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export async function adminDirectory(user: AuthUser, input: z.input<typeof adminProjectFiltersSchema> | Record<string, string> = {}) {
  assertStaff(user);
  const filters = adminProjectFiltersSchema.parse(input);
  const health = (PROJECT_HEALTH as readonly string[]).includes(filters.status);
  const statusWhere =
    filters.status === "all"
      ? {}
      : filters.status === "active"
        ? ACTIVE
        : filters.status === "completed"
          ? DONE
          : health
            ? { AND: [ACTIVE, { health: filters.status as (typeof PROJECT_HEALTH)[number] }] }
            : { status: filters.status as ProjectStatus };
  const where = {
    AND: [
      projectScope(user),
      statusWhere,
      filters.assignedTo ? { OR: [{ coordinatorId: filters.assignedTo }, { members: { some: { userId: filters.assignedTo } } }] } : {},
      filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {},
      filters.hasIssues === "true" ? { hasIssues: true } : {},
      filters.criticalOnly === "true" ? { criticalIssue: true } : {},
      filters.partnerOnly === "true" ? { partnerPriority: true } : {},
      searchWhere(filters.q),
    ],
  };
  const [total, projects] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      include: summaryInclude,
      // Premium Partner priority queue first, then critical issues, then due date.
      orderBy: [{ partnerPriority: "desc" }, { criticalIssue: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);
  return { total, page: filters.page, pageSize: filters.pageSize, projects: projects.map(toProjectSummary) };
}

export const updateProjectSchema = z
  .object({
    status: z.enum(PROJECT_STATUSES),
    /** Admin only: skip the status rules. */
    force: z.boolean(),
    statusNote: z.string().trim().max(200),
    health: z.enum(PROJECT_HEALTH),
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
  const { memberIds, coordinatorId, status, force, statusNote, ...fields } = data;
  if (force && user.role !== "ADMIN") throw new AppError("FORBIDDEN", "Only admins can override the status rules.");
  if (status === "CANCELLED") throw badRequest("Use cancel so the cancellation charge and refund are worked out.");

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

  const before = await db.project.findUnique({ where: { id: current.id }, select: { status: true } });
  const updated = await db.$transaction(async (tx) => {
    if (status && status !== before?.status) await transitionProject(tx, current.id, status, { actorId: user.id, force, note: statusNote });
    if (memberIds !== undefined) {
      await tx.projectMember.deleteMany({ where: { projectId: current.id, userId: { notIn: memberIds } } });
      await tx.projectMember.createMany({ data: memberIds.map((userId) => ({ projectId: current.id, userId })), skipDuplicates: true });
    }
    if (coordinatorId) await tx.projectMember.createMany({ data: [{ projectId: current.id, userId: coordinatorId }], skipDuplicates: true });
    return tx.project.update({ where: { id: current.id }, data: { ...fields, ...(coordinatorId !== undefined ? { coordinatorId } : {}) }, include: summaryInclude });
  });

  if (status && status !== before?.status) await notifyStatus(updated);
  return toProjectSummary(updated);
}

async function notifyStatus(project: any) {
  if (!project.client) return;
  const stage = currentMilestone(project);
  await sendTemplate("project_update", project.client.email, {
    user_name: displayName(project.client),
    project_name: project.title,
    project_ref: project.reference,
    phase: stage ? `${stage.title} (${PROJECT_STATUS_LABELS[project.status as ProjectStatus]})` : PROJECT_STATUS_LABELS[project.status as ProjectStatus],
    link: appUrl(`/dashboard/projects/${project.reference}`),
  });
}

export const advanceStageSchema = z.object({ position: z.number().int().min(0).optional(), note: z.string().trim().max(200).optional() });

/**
 * Staff move the project to the next stage (or a given one). A stage with a mapped status
 * moves the project into it (e.g. "QA review" → IN_QA, "Delivered" → DELIVERED).
 */
export async function advanceStage(user: AuthUser, reference: string, input: z.input<typeof advanceStageSchema> = {}) {
  assertStaff(user);
  const data = advanceStageSchema.parse(input);
  const { id } = await findAccessibleProject(user, reference);
  const project = await db.project.findUnique({ where: { id }, include: { milestones: { orderBy: { position: "asc" } } } });
  if (!project) throw notFound("Project");
  if (project.status === "ON_HOLD") throw conflict("This project is on hold. Lift the hold first.");
  if (project.status === "COMPLETED" || project.status === "CANCELLED") throw conflict("This project is closed.");
  const current = project.milestones.find((milestone: any) => milestone.status === "CURRENT");
  const position = data.position ?? (current ? current.position + 1 : 0);
  const target = project.milestones.find((milestone: any) => milestone.position === position);

  const updated = await db.$transaction(async (tx) => {
    if (!target) {
      // Past the last stage: the project is complete.
      if (project.status !== "DELIVERED" && user.role !== "ADMIN") throw conflict("Deliver the project before completing it.");
      await transitionProject(tx, id, "COMPLETED", { actorId: user.id, force: user.role === "ADMIN", note: data.note });
    } else {
      await setCurrentMilestone(tx, id, target.position);
      await addActivity(tx, id, user.id, "stage.changed", `Moved to ${target.title}${data.note ? ` — ${data.note}` : ""}`);
      if (target.projectStatus && target.projectStatus !== project.status) {
        await transitionProject(tx, id, target.projectStatus as ProjectStatus, { actorId: user.id, force: user.role === "ADMIN" });
      }
      // A task for the new stage on the board.
      const column = { ASSESSOR: "ASSESSMENT", DESIGNER: "DESIGN", COORDINATOR: "COORDINATION", ADMIN: "BACKLOG" }[target.defaultRole as string] as "ASSESSMENT" | "DESIGN" | "COORDINATION" | "BACKLOG";
      const stage = target.stageId ? await tx.serviceStage.findUnique({ where: { id: target.stageId }, select: { boardColumn: true } }) : null;
      const boardColumn = (stage?.boardColumn ?? column) as never;
      const exists = await tx.task.findFirst({ where: { projectId: id, milestoneId: target.id }, select: { id: true } });
      if (!exists) {
        await tx.task.create({ data: { projectId: id, title: target.title, column: boardColumn, position: await tx.task.count({ where: { projectId: id, column: boardColumn } }), tags: [target.defaultRole.charAt(0) + target.defaultRole.slice(1).toLowerCase()], milestoneId: target.id, createdById: user.id } });
      }
    }
    return tx.project.findUnique({ where: { id }, include: summaryInclude });
  });
  await notifyStatus(updated);
  return toProjectSummary(updated);
}

/** Staff list for assignment pickers and filters. */
export async function listStaff() {
  const staff = await db.user.findMany({ where: { role: { not: "CLIENT" }, status: "ACTIVE" }, select: personSelect, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] });
  return staff.map((user: any) => toPerson(user)!);
}

export function assertProjectWritable(user: AuthUser) {
  if (!isStaff(user)) throw new AppError("FORBIDDEN", "Only the project team can do that.");
}

// ─── Revisions ──────────────────────────────────────────────────────────────

export const revisionSchema = z.object({ note: z.string().trim().min(5, "Tell us what needs changing.").max(2_000) });

/**
 * Client asks for a revision on a delivered project. Included rounds (2 by default) go
 * straight to REVISION; further rounds are billable and wait for staff to accept a quote.
 */
export async function requestRevision(user: AuthUser, reference: string, input: z.input<typeof revisionSchema>) {
  const { note } = revisionSchema.parse(input);
  const { id } = await findAccessibleProject(user, reference);
  const project = await db.project.findUnique({ where: { id } });
  if (!project) throw notFound("Project");
  if (project.status !== "DELIVERED") throw conflict("Revisions can be requested once the work is delivered.");
  const pending = await db.revisionRequest.count({ where: { projectId: id, status: "REQUESTED" } });
  if (pending) throw conflict("A revision request is already waiting.");
  const settings = await getSettings();
  const round = project.revisionRoundsUsed + 1;
  const billable = round > project.revisionRoundsIncluded;

  await db.$transaction(async (tx) => {
    await tx.revisionRequest.create({
      data: { projectId: id, round, note, billable, pricePence: billable ? settings.revisions.extraRoundPence : null, status: billable ? "REQUESTED" : "ACCEPTED", requestedById: user.id, ...(billable ? {} : { decidedAt: new Date() }) },
    });
    if (!billable) {
      await tx.project.update({ where: { id }, data: { revisionRoundsUsed: round } });
      await transitionProject(tx, id, "REVISION", { actorId: user.id, note: `Revision round ${round} of ${project.revisionRoundsIncluded}` });
    } else {
      await addActivity(tx, id, user.id, "revision.requested", `Extra revision requested (round ${round}, quoted ${formatPence(settings.revisions.extraRoundPence)} + VAT)`);
    }
  });
  return getProject(user, reference);
}

export const revisionDecisionSchema = z.object({ accept: z.boolean(), pricePence: z.number().int().min(0).optional() });

/** Staff accept (billable rounds are invoiced) or decline an extra revision. */
export async function decideRevision(user: AuthUser, revisionId: string, input: z.input<typeof revisionDecisionSchema>) {
  assertStaff(user);
  const data = revisionDecisionSchema.parse(input);
  const revision = await db.revisionRequest.findUnique({ where: { id: revisionId }, include: { project: true } });
  if (!revision) throw notFound("Revision");
  await findAccessibleProject(user, revision.project.reference);
  if (revision.status !== "REQUESTED") throw conflict("This request has already been decided.");
  const settings = await getSettings();
  await db.$transaction(async (tx) => {
    await tx.revisionRequest.update({ where: { id: revisionId }, data: { status: data.accept ? "ACCEPTED" : "DECLINED", decidedById: user.id, decidedAt: new Date(), ...(data.pricePence !== undefined ? { pricePence: data.pricePence } : {}) } });
    if (!data.accept) return addActivity(tx, revision.projectId, user.id, "revision.declined", "Extra revision declined");
    const price = data.pricePence ?? revision.pricePence ?? 0;
    if (revision.billable && price > 0) {
      const vat = Math.round((price * settings.vat.rateBps) / 10_000);
      await issueInvoice(tx, {
        userId: revision.project.clientId,
        kind: "CHARGE",
        description: `Extra revision round ${revision.round} — ${revision.project.reference}`,
        lines: [{ description: `Revision round ${revision.round}: ${revision.project.title}`, netPence: price, vatPence: vat, totalPence: price + vat }],
        dueAt: new Date(Date.now() + 7 * 86_400_000),
        settings,
      });
    }
    await tx.project.update({ where: { id: revision.projectId }, data: { revisionRoundsUsed: revision.round } });
    await transitionProject(tx, revision.projectId, "REVISION", { actorId: user.id, force: revision.project.status !== "DELIVERED" && user.role === "ADMIN", note: `Revision round ${revision.round}` });
  });
  return getProject(user, revision.project.reference);
}

// ─── Cancellation ───────────────────────────────────────────────────────────

async function cancellationQuote(projectId: string) {
  const settings = await getSettings();
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { orderLine: { include: { order: true, invoiceLine: true } }, visits: { where: { status: "BOOKED" }, orderBy: { date: "asc" } } },
  });
  if (!project) throw notFound("Project");
  const next = project.visits[0];
  const nextVisitAt = next ? new Date(`${next.date.toISOString().slice(0, 10)}T${next.window === "AM" ? "08:00" : "12:00"}:00Z`) : null;
  const rule = cancellationPercent(
    { status: project.status as ProjectStatus, workStarted: Boolean(project.workStartedAt), delivered: Boolean(project.deliveredAt), nextVisitAt, now: new Date() },
    settings.cancellation,
  );
  const line = project.orderLine;
  const net = line?.netPence ?? 0;
  const feeNet = Math.round((net * rule.percent) / 100);
  const feeVat = Math.round((feeNet * settings.vat.rateBps) / 10_000);
  const paid = line && line.order.paymentMethod !== "WEEKLY_INVOICE" && line.order.paidAt ? line.totalPence : 0;
  return { project, line, settings, percent: rule.percent, reason: rule.reason, feeNetPence: feeNet, feeTotalPence: feeNet + feeVat, refundPence: Math.max(0, paid - (feeNet + feeVat)) };
}

/** GET /api/projects/:ref/cancel — what cancelling now would cost. */
export async function previewCancellation(user: AuthUser, reference: string) {
  const { id } = await findAccessibleProject(user, reference);
  const quote = await cancellationQuote(id);
  if (["COMPLETED", "CANCELLED"].includes(quote.project.status)) throw conflict("This project is closed.");
  return { percent: quote.percent, reason: quote.reason, feePence: quote.feeTotalPence, refundPence: quote.refundPence, refundTo: quote.line?.order.paymentMethod === "CARD" ? "card" : quote.line?.order.paymentMethod === "WEEKLY_INVOICE" ? "invoice" : "account credit" };
}

export const cancelSchema = z.object({ reason: z.string().trim().min(3, "Tell us why.").max(500), expectedFeePence: z.number().int().min(0).optional() });

/**
 * Cancel a booked project (client, or admin). Charges per agreement clause 11 and refunds
 * the rest: to the card (Basic), to account credit (partners paying in advance), or by
 * leaving it off / crediting the weekly invoice.
 */
export async function cancelProject(user: AuthUser, reference: string, input: z.input<typeof cancelSchema>) {
  const data = cancelSchema.parse(input);
  if (isStaff(user) && user.role !== "ADMIN") throw new AppError("FORBIDDEN", "Only admins or the client can cancel a project.");
  const { id } = await findAccessibleProject(user, reference);
  const quote = await cancellationQuote(id);
  const { project, line, settings } = quote;
  if (["COMPLETED", "CANCELLED"].includes(project.status)) throw conflict("This project is already closed.");
  if (data.expectedFeePence !== undefined && data.expectedFeePence !== quote.feeTotalPence) throw conflict("The cancellation charge has changed. Please review it again.", { feePence: quote.feeTotalPence });

  await db.$transaction(async (tx) => {
    for (const visit of project.visits) {
      await tx.visit.update({ where: { id: visit.id }, data: { status: "CANCELLED" } });
      if (visit.availabilityId) await releaseSlot(tx, visit.availabilityId);
    }
    await tx.project.update({ where: { id }, data: { cancellationFeePence: quote.feeNetPence } });
    await transitionProject(tx, id, "CANCELLED", { actorId: user.id, force: true, note: data.reason });

    if (!line) return;
    const method = line.order.paymentMethod;
    if ((method === "CREDIT" || method === "CREDIT_AND_CARD") && quote.refundPence > 0) {
      await addCreditEntry(tx, { userId: project.clientId, type: "REFUND", amountPence: quote.refundPence, orderId: line.orderId, note: `Cancellation of ${project.reference}` });
    }
    if (method === "WEEKLY_INVOICE" && line.invoiceLine) {
      // Already invoiced: credit note for everything except the fee.
      const credit = line.totalPence - quote.feeTotalPence;
      if (credit > 0) {
        const vat = Math.round(credit - (credit * 10_000) / (10_000 + settings.vat.rateBps));
        await issueInvoice(tx, {
          userId: project.clientId,
          kind: "CHARGE",
          description: `Credit note: cancellation of ${project.reference}`,
          lines: [{ description: `Credit for ${line.serviceTitle} (${project.reference})`, netPence: -(credit - vat), vatPence: -vat, totalPence: -credit }],
          settings,
        });
      }
    }
  });

  // Card refunds happen outside the transaction (an API call).
  if (line?.order.paymentMethod === "CARD" && quote.refundPence > 0 && line.order.stripePaymentIntentId && integrations.stripe()) {
    try {
      await requireStripe().refunds.create({ payment_intent: line.order.stripePaymentIntentId, amount: quote.refundPence, metadata: { projectReference: project.reference } });
      await db.activity.create({ data: { projectId: id, actorId: user.id, type: "refund.issued", message: `${formatPence(quote.refundPence)} refunded to the card` } });
    } catch (error) {
      console.error("[cancel] refund failed", error);
      await db.activity.create({ data: { projectId: id, actorId: user.id, type: "refund.failed", message: `Card refund of ${formatPence(quote.refundPence)} needs to be issued manually` } });
    }
  }
  await audit(user.id, "project.cancel", "Project", id, { fee: quote.feeTotalPence, refund: quote.refundPence, reason: data.reason });
  return { feePence: quote.feeTotalPence, refundPence: quote.refundPence };
}
