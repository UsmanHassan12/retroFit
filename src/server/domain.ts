/**
 * Domain vocabulary shared by services, route handlers and the seed. These mirror the
 * Prisma enums as plain string unions so they are usable anywhere (including the client
 * bundle) without importing the generated Prisma client.
 */

export const ROLES = ["CLIENT", "ASSESSOR", "DESIGNER", "COORDINATOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES = ["ASSESSOR", "DESIGNER", "COORDINATOR", "ADMIN"] as const satisfies readonly Role[];
export const isStaffRole = (role: string) => (STAFF_ROLES as readonly string[]).includes(role);

export const PLANS = ["FREE", "PRIORITY", "ENTERPRISE"] as const;
export type Plan = (typeof PLANS)[number];

export const SERVICE_CATEGORIES = ["ASSESSMENT", "DESIGN", "COORDINATION", "FULL_PACKAGE", "FUNDING"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const ORDER_STATUSES = ["DRAFT", "PENDING_PAYMENT", "PAID", "CANCELLED", "REFUNDED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PROJECT_PHASES = [
  "PURCHASED",
  "ASSESSMENT",
  "SURVEY",
  "DESIGN",
  "COORDINATION",
  "INSTALLATION",
  "QA",
  "COMPLETED",
] as const;
export type ProjectPhase = (typeof PROJECT_PHASES)[number];

export const PHASE_LABELS: Record<ProjectPhase, string> = {
  PURCHASED: "Purchase Completed",
  ASSESSMENT: "Assessment",
  SURVEY: "Technical Survey",
  DESIGN: "Retrofit Design",
  COORDINATION: "Coordination",
  INSTALLATION: "Installation",
  QA: "Quality Check",
  COMPLETED: "Completed",
};

/** Default progress for each phase (staff can override). */
export const phaseProgress = (phase: ProjectPhase) =>
  Math.round((PROJECT_PHASES.indexOf(phase) / (PROJECT_PHASES.length - 1)) * 100);

export const PROJECT_STATUSES = ["ON_TRACK", "AT_RISK", "DELAYED", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "QA_REJECT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_COLUMNS = ["BACKLOG", "AWAITING_CLIENT", "ASSESSMENT", "DESIGN", "COORDINATION", "QA", "DONE"] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];
export const TASK_COLUMN_LABELS: Record<TaskColumn, string> = {
  BACKLOG: "Backlog",
  AWAITING_CLIENT: "Awaiting Client",
  ASSESSMENT: "Assessment",
  DESIGN: "Design",
  COORDINATION: "Coordination",
  QA: "QA",
  DONE: "Done",
};

export const DELIVERABLE_KINDS = ["PDF", "SPREADSHEET", "REPORT"] as const;
export const DELIVERABLE_STATUSES = ["PENDING", "IN_PROGRESS", "AVAILABLE"] as const;

export const SCHEMES = ["ECO4", "GBIS"] as const;

export const EMAIL_TEMPLATE_KEYS = ["project_update", "invite", "password_reset", "order_confirmation"] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

/** Pricing constants. Money is always integer pence. */
export const VAT_RATE_PERCENT = 20;
export const PRIORITY_PLAN_DISCOUNT_PERCENT = 15;
export const PRIORITY_PLAN_PRICE_PENCE = 2900;

/** Upload rules for project documents. */
export const UPLOAD_RULES = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
};
