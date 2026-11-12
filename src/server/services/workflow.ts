import "server-only";

import { db, type Tx } from "../db";
import { conflict, notFound } from "../errors";
import { PROJECT_STATUS_LABELS, type CustomerTier, type ProjectStatus, type TaskColumn } from "../domain";
import { dueDate, zonedTime, ymdOf } from "../rules/calendar";
import { evaluate } from "../rules/conditions";
import { AUTO_ADVANCE_FROM, canTransition, readinessStatus, statusProgress } from "../rules/workflow";
import { checkAnswers, commonQuestions, intakeFacts, serviceQuestions } from "./intake";
import { nextProjectReference } from "./references";
import { getBankHolidays, getSettings, type Settings } from "./settings";

/**
 * Project lifecycle: creating projects from a confirmed order, keeping the status in step
 * with what we know (intake, documents, visit), stage advances, due dates and holds.
 * All functions take a transaction client so callers decide the transaction boundary.
 */

const ROLE_COLUMN: Record<string, TaskColumn> = { ASSESSOR: "ASSESSMENT", DESIGNER: "DESIGN", COORDINATOR: "COORDINATION", ADMIN: "BACKLOG" };

/** Least-loaded active coordinator, for auto-assignment. */
async function pickCoordinator(tx: Tx) {
  const coordinators = await tx.user.findMany({
    where: { role: "COORDINATOR", status: "ACTIVE" },
    select: { id: true, _count: { select: { coordinatedProjects: { where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } } } },
  });
  coordinators.sort((a: any, b: any) => a._count.coordinatedProjects - b._count.coordinatedProjects);
  return (coordinators[0]?.id as string | undefined) ?? null;
}

/** Take one place in an availability slot. False when it filled up in the meantime. */
export async function reserveSlot(tx: Tx, availabilityId: string) {
  const updated = await tx.$executeRaw`UPDATE "Availability" SET "bookedCount" = "bookedCount" + 1 WHERE id = ${availabilityId} AND "bookedCount" < capacity`;
  return updated > 0;
}

export async function releaseSlot(tx: Tx, availabilityId: string) {
  await tx.$executeRaw`UPDATE "Availability" SET "bookedCount" = GREATEST("bookedCount" - 1, 0) WHERE id = ${availabilityId}`;
}

export async function addActivity(tx: Tx, projectId: string, actorId: string | null, type: string, message: string) {
  await tx.activity.create({ data: { projectId, actorId, type, message } });
}

// ─── Creating projects ──────────────────────────────────────────────────────

const lineInclude = {
  property: true,
  addons: true,
  service: {
    include: {
      stages: { orderBy: { position: "asc" as const } },
      deliverables: { orderBy: { position: "asc" as const } },
    },
  },
} as const;

/** Called inside the order-confirmation transaction: one project per order line. */
export async function createProjectsForOrder(tx: Tx, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, include: { lines: { include: lineInclude, orderBy: { position: "asc" } } } });
  if (!order) throw notFound("Order");
  const now = new Date();
  const created: Array<{ id: string; reference: string }> = [];
  const scheme = typeof (order.answers as Record<string, unknown>)?.scheme === "string" ? ((order.answers as Record<string, string>).scheme as string) : null;
  const validScheme = scheme && ["ECO4", "GBIS", "WHLG", "SHDF", "PRIVATE", "OTHER"].includes(scheme) ? scheme : null;

  for (const line of order.lines) {
    if (await tx.project.findUnique({ where: { orderLineId: line.id }, select: { id: true } })) continue;
    const service = line.service;
    const coordinatorId = await pickCoordinator(tx);
    const stages = service.stages;
    const address = line.property ? `${line.property.line1}, ${line.property.postcode}` : null;

    const project = await tx.project.create({
      data: {
        reference: await nextProjectReference(tx, now),
        orderId: order.id,
        orderLineId: line.id,
        clientId: order.userId,
        serviceId: service.id,
        propertyId: line.propertyId,
        coordinatorId,
        title: address ? `${line.serviceTitle} — ${address}` : line.serviceTitle,
        status: "AWAITING_INFO",
        partnerPriority: order.customerTier === "PARTNER",
        priority: order.customerTier === "PARTNER" ? "HIGH" : "MEDIUM",
        fastTrack: line.fastTrack,
        turnaroundDays: line.turnaroundDays,
        revisionRoundsIncluded: service.revisionRounds,
        scheme: validScheme as never,
        progress: 5,
        milestones: {
          create: stages.map((stage: any, index: number) => ({
            stageId: stage.id,
            position: index,
            title: stage.name,
            description: stage.description,
            clientVisible: stage.clientVisible,
            defaultRole: stage.defaultRole,
            projectStatus: stage.projectStatus,
            status: index === 0 ? ("DONE" as const) : index === 1 ? ("CURRENT" as const) : ("UPCOMING" as const),
            startedAt: index <= 1 ? now : null,
            completedAt: index === 0 ? now : null,
          })),
        },
        deliverables: {
          create: service.deliverables.map((item: any) => ({
            serviceDeliverableId: item.id,
            title: item.name,
            description: item.description || "Prepared during your project.",
            kind: item.kind,
            versioned: item.versioned,
            status: "PENDING" as const,
          })),
        },
        activities: { create: [{ actorId: order.userId, type: "order.confirmed", message: `Order ${order.reference} confirmed` }] },
        ...(coordinatorId ? { members: { create: [{ userId: coordinatorId }] } } : {}),
      },
      include: { milestones: { orderBy: { position: "asc" } } },
    });

    // First tasks: the stage that is now current, plus "Order confirmed" for the record.
    const current = project.milestones.find((milestone: any) => milestone.status === "CURRENT");
    await tx.task.create({ data: { projectId: project.id, title: "Order confirmed", column: "DONE", position: 0, tags: ["System"], completedAt: now, milestoneId: project.milestones[0]?.id ?? null } });
    if (current) {
      const column = (stages[current.position]?.boardColumn as TaskColumn | undefined) ?? ROLE_COLUMN[current.defaultRole] ?? "BACKLOG";
      await tx.task.create({
        data: {
          projectId: project.id,
          title: current.title,
          column,
          position: await tx.task.count({ where: { projectId: project.id, column } }),
          tags: [current.defaultRole.charAt(0) + current.defaultRole.slice(1).toLowerCase()],
          assigneeId: current.defaultRole === "COORDINATOR" ? coordinatorId : null,
          milestoneId: current.id,
        },
      });
    }

    // Visit slot picked at checkout.
    if (line.availabilityId) {
      const slot = await tx.availability.findUnique({ where: { id: line.availabilityId } });
      if (slot && (await reserveSlot(tx, slot.id))) {
        await tx.visit.create({ data: { projectId: project.id, availabilityId: slot.id, assessorId: slot.assessorId, date: slot.date, window: slot.window, kind: "INITIAL" } });
        await tx.projectMember.createMany({ data: [{ projectId: project.id, userId: slot.assessorId }], skipDuplicates: true });
        await addActivity(tx, project.id, null, "visit.booked", `Site visit booked for ${ymdOf(slot.date)} (${slot.window})`);
      } else {
        await addActivity(tx, project.id, null, "visit.unavailable", "The chosen visit slot was taken. Please pick another date.");
      }
    }

    await refreshProject(tx, project.id, { actorId: null });
    created.push({ id: project.id, reference: project.reference });
  }
  return created;
}

// ─── What's missing ─────────────────────────────────────────────────────────

const stateInclude = {
  service: { include: { documentRequirements: { orderBy: { position: "asc" as const } } } },
  documents: { where: { status: "ACTIVE" as const }, select: { requirementKey: true } },
  visits: { where: { status: { in: ["BOOKED", "COMPLETED"] as ("BOOKED" | "COMPLETED")[] } }, orderBy: { date: "asc" as const } },
  property: { select: { tenure: true } },
  client: { select: { customerType: true } },
  orderLine: { include: { order: { include: { lines: { select: { serviceCode: true } } } } } },
} as const;

/** Everything the readiness rules need, computed from the database. */
export async function projectState(tx: Tx | typeof db, projectId: string) {
  const project = await tx.project.findUnique({ where: { id: projectId }, include: stateInclude });
  if (!project) throw notFound("Project");
  const order = project.orderLine?.order;
  const facts = intakeFacts({
    tier: (order?.customerTier ?? "BASIC") as CustomerTier,
    serviceCodes: order ? order.lines.map((line: { serviceCode: string }) => line.serviceCode) : [project.service.code],
    customerType: project.client.customerType,
    tenure: project.property?.tenure ?? null,
  });
  const orderAnswers = (order?.answers ?? {}) as Record<string, unknown>;
  const lineAnswers = (project.orderLine?.answers ?? {}) as Record<string, unknown>;

  const [common, perService] = await Promise.all([commonQuestions(), serviceQuestions([project.serviceId])]);
  const orderCheck = checkAnswers(common.filter((question) => question.scope === "ORDER"), orderAnswers, facts, { lenient: true });
  const lineCheck = checkAnswers([...common.filter((question) => question.scope === "LINE"), ...(perService.get(project.serviceId) ?? [])], lineAnswers, { ...facts, ...orderCheck.answers }, { lenient: true });
  const context = { ...facts, ...orderCheck.answers, ...lineCheck.answers };

  const uploaded = new Set(project.documents.map((doc: { requirementKey: string | null }) => doc.requirementKey).filter(Boolean));
  const documents = project.service.documentRequirements
    .filter((requirement: any) => evaluate(requirement.condition, context))
    .map((requirement: any) => ({
      key: requirement.key as string,
      label: requirement.label as string,
      required: requirement.required as boolean,
      timing: requirement.timing as string,
      acceptedTypes: requirement.acceptedTypes as string[],
      maxBytes: requirement.maxBytes as number,
      uploaded: uploaded.has(requirement.key),
    }));
  const missingDocuments = documents.filter((doc: { required: boolean; timing: string; uploaded: boolean }) => doc.required && doc.timing === "BEFORE_START" && !doc.uploaded);

  const needsVisit = project.service.siteVisit === "REQUIRED";
  const upcoming = project.visits.find((visit: any) => visit.status === "BOOKED") ?? null;
  const anyVisit = project.visits[0] ?? null;

  return {
    project,
    missingAnswers: [...orderCheck.missing.map((item) => ({ ...item, scope: "ORDER" as const })), ...lineCheck.missing.map((item) => ({ ...item, scope: "LINE" as const }))],
    documents,
    missingDocuments,
    intakeComplete: orderCheck.missing.length === 0 && lineCheck.missing.length === 0,
    documentsComplete: missingDocuments.length === 0,
    needsVisit,
    visitBooked: Boolean(upcoming || (anyVisit && anyVisit.status === "COMPLETED")),
    firstVisit: anyVisit as null | { date: Date; window: "AM" | "PM"; status: string },
    nextVisit: upcoming as null | { date: Date; window: "AM" | "PM" },
  };
}

// ─── Status changes ─────────────────────────────────────────────────────────

/** Make the first milestone whose stage maps to `status` current (earlier ones done). */
async function syncMilestones(tx: Tx, projectId: string, status: ProjectStatus) {
  const milestones = await tx.projectMilestone.findMany({ where: { projectId }, orderBy: { position: "asc" } });
  const current = milestones.find((milestone: any) => milestone.status === "CURRENT");
  const target = milestones.find((milestone: any) => milestone.projectStatus === status && (!current || milestone.position >= current.position));
  if (!target || target.id === current?.id) return;
  await setCurrentMilestone(tx, projectId, target.position);
}

/** Mark milestones before `position` done, `position` current, the rest upcoming. */
export async function setCurrentMilestone(tx: Tx, projectId: string, position: number) {
  const now = new Date();
  await tx.projectMilestone.updateMany({ where: { projectId, position: { lt: position }, completedAt: null }, data: { status: "DONE", completedAt: now } });
  await tx.projectMilestone.updateMany({ where: { projectId, position: { lt: position } }, data: { status: "DONE" } });
  await tx.projectMilestone.updateMany({ where: { projectId, position }, data: { status: "CURRENT", completedAt: null } });
  await tx.projectMilestone.updateMany({ where: { projectId, position, startedAt: null }, data: { startedAt: now } });
  await tx.projectMilestone.updateMany({ where: { projectId, position: { gt: position } }, data: { status: "UPCOMING", completedAt: null } });
}

/**
 * Change a project's status through the state machine. `force` (admins) skips the rule.
 * Side effects: hold bookkeeping, timestamps, milestones and progress.
 */
export async function transitionProject(tx: Tx, projectId: string, to: ProjectStatus, options: { actorId: string | null; force?: boolean; note?: string }) {
  const project = await tx.project.findUnique({ where: { id: projectId }, include: { milestones: { orderBy: { position: "asc" } } } });
  if (!project) throw notFound("Project");
  const from = project.status as ProjectStatus;
  if (from === to) return project;
  if (!options.force && !canTransition(from, to)) {
    throw conflict(`A project can't move from ${PROJECT_STATUS_LABELS[from]} to ${PROJECT_STATUS_LABELS[to]}.`);
  }
  const now = new Date();
  const data: Record<string, unknown> = { status: to };
  if (to === "ON_HOLD") data.statusBeforeHold = from;
  if (from === "ON_HOLD") data.statusBeforeHold = null;
  if (to === "IN_PROGRESS" && !project.workStartedAt) data.workStartedAt = now;
  if (to === "DELIVERED") data.deliveredAt = now;
  if (to === "COMPLETED") Object.assign(data, { completedAt: now, progress: 100 });
  if (to === "CANCELLED") data.cancelledAt = now;

  await tx.project.update({ where: { id: projectId }, data: data as never });
  if (to === "COMPLETED") {
    await tx.projectMilestone.updateMany({ where: { projectId, completedAt: null }, data: { status: "DONE", completedAt: now } });
    await tx.projectMilestone.updateMany({ where: { projectId }, data: { status: "DONE" } });
  } else if (to !== "ON_HOLD" && to !== "CANCELLED" && to !== "AWAITING_INFO") {
    await syncMilestones(tx, projectId, to);
  }
  await updateProgress(tx, projectId);
  await addActivity(tx, projectId, options.actorId, "status.changed", `${PROJECT_STATUS_LABELS[to]}${options.note ? ` — ${options.note}` : ""}`);
  return project;
}

async function updateProgress(tx: Tx, projectId: string) {
  const project = await tx.project.findUnique({ where: { id: projectId }, include: { milestones: { orderBy: { position: "asc" } } } });
  if (!project) return;
  const index = Math.max(0, project.milestones.findIndex((milestone: any) => milestone.status === "CURRENT"));
  await tx.project.update({ where: { id: projectId }, data: { progress: statusProgress(project.status as ProjectStatus, index, project.milestones.length) } });
}

/**
 * Re-evaluate a project after anything that affects readiness: confirmation, answers,
 * documents, visit booked/cancelled, hold lifted. Moves AWAITING_INFO / SCHEDULED projects
 * along automatically and recomputes the due date.
 */
export async function refreshProject(tx: Tx, projectId: string, options: { actorId: string | null }) {
  const state = await projectState(tx, projectId);
  const project = state.project;
  const status = project.status as ProjectStatus;
  const now = new Date();

  if (state.intakeComplete && state.documentsComplete && !project.intakeCompleteAt) {
    await tx.project.update({ where: { id: projectId }, data: { intakeCompleteAt: now } });
  } else if ((!state.intakeComplete || !state.documentsComplete) && project.intakeCompleteAt) {
    await tx.project.update({ where: { id: projectId }, data: { intakeCompleteAt: null } });
  }

  if ((AUTO_ADVANCE_FROM as readonly string[]).includes(status)) {
    const target = readinessStatus(state);
    if (target !== status && canTransition(status, target)) await transitionProject(tx, projectId, target, { actorId: options.actorId });
  }
  await recomputeDueDate(tx, projectId);
  return state;
}

/**
 * Due date = clock start + turnaround in working days (bank holidays skipped). The clock
 * starts when intake is complete or at the site visit, whichever is later, and restarts when
 * a hold is lifted. Milestone targets follow each stage's SLA.
 */
export async function recomputeDueDate(tx: Tx, projectId: string, preloaded?: { settings: Settings; holidays: ReadonlySet<string> }) {
  const settings = preloaded?.settings ?? (await getSettings());
  const holidays = preloaded?.holidays ?? (await getBankHolidays());
  const project = await tx.project.findUnique({
    where: { id: projectId },
    include: {
      service: { select: { siteVisit: true } },
      visits: { where: { status: { in: ["BOOKED", "COMPLETED"] } }, orderBy: { date: "asc" }, take: 1 },
      milestones: { orderBy: { position: "asc" }, include: { stage: { select: { slaDays: true } } } },
    },
  });
  if (!project) return;
  const timeZone = settings.booking.timeZone;

  const starts: Date[] = [];
  if (project.intakeCompleteAt) starts.push(project.intakeCompleteAt);
  if (project.service.siteVisit === "REQUIRED") {
    const visit = project.visits[0];
    if (visit) {
      const windowStart = (settings.booking.windows[visit.window as "AM" | "PM"] ?? "08:00").slice(0, 5);
      starts.push(zonedTime(ymdOf(visit.date), /^\d{2}:\d{2}$/.test(windowStart) ? windowStart : "08:00", timeZone));
    } else starts.length = 0;
  }
  if (project.clockRestartAt && starts.length) starts.push(project.clockRestartAt);
  const ready = project.intakeCompleteAt && starts.length > 0;
  const clockStartAt = ready ? new Date(Math.max(...starts.map((date) => date.getTime()))) : null;

  const due =
    clockStartAt && project.turnaroundDays !== null
      ? dueDate({ start: clockStartAt, days: project.turnaroundDays, holidays, sameDayCutoff: settings.booking.sameDayCutoff, dueTime: settings.booking.dueTime, timeZone })
      : null;
  // Services without a fixed turnaround (Coordination "runs to lodgement") keep the date staff set.
  await tx.project.update({ where: { id: projectId }, data: { clockStartAt, ...(project.turnaroundDays !== null ? { dueDate: due } : {}) } });

  if (clockStartAt) {
    let cumulative = 0;
    for (const milestone of project.milestones) {
      const sla = milestone.stage?.slaDays;
      if (sla === null || sla === undefined || milestone.status === "DONE") continue;
      cumulative += sla;
      await tx.projectMilestone.update({
        where: { id: milestone.id },
        data: { dueAt: dueDate({ start: clockStartAt, days: cumulative, holidays, sameDayCutoff: settings.booking.sameDayCutoff, dueTime: settings.booking.dueTime, timeZone }) },
      });
    }
  }
}

// ─── Account holds ──────────────────────────────────────────────────────────

/** Pause every open project of a user (account hold). */
export async function pauseProjectsForHold(tx: Tx, userId: string, actorId: string | null) {
  const projects = await tx.project.findMany({
    where: { clientId: userId, status: { notIn: ["COMPLETED", "CANCELLED", "ON_HOLD"] } },
    select: { id: true },
  });
  for (const project of projects) await transitionProject(tx, project.id, "ON_HOLD", { actorId, force: true, note: "Account on hold" });
  return projects.length;
}

/** Resume projects paused by a hold; turnaround restarts now. */
export async function resumeProjectsAfterHold(tx: Tx, userId: string, actorId: string | null) {
  const projects = await tx.project.findMany({ where: { clientId: userId, status: "ON_HOLD" }, select: { id: true, statusBeforeHold: true } });
  const now = new Date();
  for (const project of projects) {
    const back = (project.statusBeforeHold as ProjectStatus | null) ?? "AWAITING_INFO";
    await tx.project.update({ where: { id: project.id }, data: { clockRestartAt: now } });
    await transitionProject(tx, project.id, back, { actorId, force: true, note: "Hold lifted" });
    await refreshProject(tx, project.id, { actorId });
  }
  return projects.length;
}

export async function activeHold(userId: string, client: Tx | typeof db = db) {
  return client.accountHold.findFirst({ where: { userId, liftedAt: null }, orderBy: { startedAt: "desc" } });
}
