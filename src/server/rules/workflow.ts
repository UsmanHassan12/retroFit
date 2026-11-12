import type { ProjectStatus } from "../domain";

/**
 * Project status model (catalogue doc → "Project status model"):
 *   AWAITING_PAYMENT → AWAITING_INFO → SCHEDULED → IN_PROGRESS → IN_QA → DELIVERED
 *   → REVISION (optional loop back to IN_PROGRESS) → COMPLETED
 *   Side states: ON_HOLD (account hold or client query) and CANCELLED.
 * Pure rules; the services apply them and record activity.
 */

const TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  AWAITING_PAYMENT: ["AWAITING_INFO", "SCHEDULED", "IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  AWAITING_INFO: ["SCHEDULED", "IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  SCHEDULED: ["IN_PROGRESS", "AWAITING_INFO", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["IN_QA", "AWAITING_INFO", "SCHEDULED", "ON_HOLD", "CANCELLED"],
  IN_QA: ["IN_PROGRESS", "DELIVERED", "ON_HOLD", "CANCELLED"],
  DELIVERED: ["REVISION", "COMPLETED", "ON_HOLD"],
  REVISION: ["IN_PROGRESS", "IN_QA", "DELIVERED", "ON_HOLD", "CANCELLED"],
  COMPLETED: [],
  // Leaving a hold goes back to the saved status (checked separately).
  ON_HOLD: ["AWAITING_INFO", "SCHEDULED", "IN_PROGRESS", "IN_QA", "DELIVERED", "REVISION", "CANCELLED"],
  CANCELLED: [],
};

export function canTransition(from: ProjectStatus, to: ProjectStatus) {
  return from === to || TRANSITIONS[from].includes(to);
}

export const allowedTransitions = (from: ProjectStatus) => TRANSITIONS[from];

export const isClosed = (status: ProjectStatus) => status === "COMPLETED" || status === "CANCELLED";

/** Work is "paused" (no task moves, clock stopped) in these. */
export const isPaused = (status: ProjectStatus) => status === "ON_HOLD" || status === "AWAITING_INFO" || status === "AWAITING_PAYMENT";

/**
 * Where a confirmed project should sit, given what we know about it. Used at creation, when
 * documents or answers arrive, and when a hold lifts.
 */
export function readinessStatus(input: {
  intakeComplete: boolean;
  documentsComplete: boolean;
  needsVisit: boolean;
  visitBooked: boolean;
}): ProjectStatus {
  if (!input.intakeComplete || !input.documentsComplete) return "AWAITING_INFO";
  if (input.needsVisit) return input.visitBooked ? "SCHEDULED" : "AWAITING_INFO";
  return "IN_PROGRESS";
}

/** Statuses from which readiness may move a project forward automatically. */
export const AUTO_ADVANCE_FROM: readonly ProjectStatus[] = ["AWAITING_PAYMENT", "AWAITING_INFO", "SCHEDULED"];

/** Default progress % for a status when stages give no better signal. */
export function statusProgress(status: ProjectStatus, stageIndex: number, stageCount: number) {
  if (status === "COMPLETED") return 100;
  if (status === "DELIVERED") return 95;
  if (stageCount <= 1) return status === "AWAITING_INFO" ? 5 : 10;
  return Math.max(5, Math.min(95, Math.round((stageIndex / (stageCount - 1)) * 95)));
}

// ─── Cancellation ───────────────────────────────────────────────────────────

export type CancellationRules = {
  /** % charged once a visit is booked but more than `withinHoursOfVisit` away (draft: free → 0). */
  visitBookedPercent: number;
  workStartedPercent: number;
  withinHoursOfVisit: number;
  deliveredPercent: number;
};

/**
 * Cancellation fee as a % of the service price (draft agreement clause 11):
 * free before the visit is booked or work starts; 50% once work has started or within 24
 * hours of a visit; 100% once delivered.
 */
export function cancellationPercent(
  input: { status: ProjectStatus; workStarted: boolean; delivered: boolean; nextVisitAt: Date | null; now: Date },
  rules: CancellationRules,
) {
  if (input.delivered || input.status === "DELIVERED" || input.status === "REVISION" || input.status === "COMPLETED") {
    return { percent: rules.deliveredPercent, reason: "Work has been delivered." };
  }
  const visitSoon = input.nextVisitAt !== null && input.nextVisitAt.getTime() - input.now.getTime() < rules.withinHoursOfVisit * 3_600_000;
  if (input.workStarted || input.status === "IN_PROGRESS" || input.status === "IN_QA") {
    return { percent: rules.workStartedPercent, reason: "Work has started." };
  }
  if (visitSoon) return { percent: rules.workStartedPercent, reason: `The visit is within ${rules.withinHoursOfVisit} hours.` };
  if (input.nextVisitAt) return { percent: rules.visitBookedPercent, reason: "A visit is booked." };
  return { percent: 0, reason: "Nothing has started yet." };
}
