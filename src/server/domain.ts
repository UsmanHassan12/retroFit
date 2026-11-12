/**
 * Domain vocabulary shared by services, route handlers and the seed. These mirror the
 * Prisma enums as plain string unions so they are usable anywhere (including the client
 * bundle) without importing the generated Prisma client.
 *
 * Commercial values (prices, discounts, cut-offs, turnaround) are NOT here: they live in
 * the database (catalogue rows and the `Setting` table) so StepSoft can change them from
 * the admin console. See src/server/services/settings.ts.
 */

export const ROLES = ["CLIENT", "ASSESSOR", "DESIGNER", "COORDINATOR", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES = ["ASSESSOR", "DESIGNER", "COORDINATOR", "ADMIN"] as const satisfies readonly Role[];
export const isStaffRole = (role: string) => (STAFF_ROLES as readonly string[]).includes(role);

export const CUSTOMER_TYPES = [
  "HOMEOWNER",
  "LANDLORD",
  "INSTALLER",
  "MANAGING_AGENT",
  "HOUSING_ASSOCIATION",
  "LOCAL_AUTHORITY",
  "BUSINESS",
] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TIERS = ["BASIC", "PARTNER"] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const PARTNER_STATUSES = ["APPLIED", "OFFERED", "ACTIVE", "SUSPENDED", "CANCELLED", "REJECTED"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export const PAYMENT_MODES = ["ADVANCE", "WEEKLY"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PAYMENT_METHODS = ["CARD", "CREDIT", "CREDIT_AND_CARD", "WEEKLY_INVOICE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SERVICE_CATEGORIES = ["ASSESSMENT", "DESIGN", "COORDINATION", "CALCULATIONS", "SURVEYS", "FUNDING", "COMPLIANCE"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SCHEMES = ["ECO4", "GBIS", "WHLG", "SHDF", "PRIVATE", "OTHER"] as const;
export type Scheme = (typeof SCHEMES)[number];
export const SCHEME_LABELS: Record<Scheme, string> = {
  ECO4: "ECO4",
  GBIS: "GBIS",
  WHLG: "Warm Homes Local Grant",
  SHDF: "SHDF",
  PRIVATE: "Private",
  OTHER: "Other",
};

export const PRICE_UNITS = ["PROPERTY", "ELEMENT", "JUNCTION", "VISIT", "PACKAGE"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];
export const PRICE_UNIT_LABELS: Record<PriceUnit, { one: string; many: string }> = {
  PROPERTY: { one: "property", many: "properties" },
  ELEMENT: { one: "element", many: "elements" },
  JUNCTION: { one: "junction", many: "junctions" },
  VISIT: { one: "visit", many: "visits" },
  PACKAGE: { one: "package", many: "packages" },
};

export const SITE_VISIT = ["NONE", "REQUIRED", "OPTIONAL"] as const;
export type SiteVisit = (typeof SITE_VISIT)[number];

export const STAGE_ROLES = ["ASSESSOR", "DESIGNER", "COORDINATOR", "ADMIN"] as const;
export type StageRole = (typeof STAGE_ROLES)[number];

export const ADDON_KINDS = ["PERCENT_OF_LIST", "PER_UNIT", "PER_MILE", "FIXED"] as const;
export type AddonKind = (typeof ADDON_KINDS)[number];
export const ADDON_AUDIENCES = ["ALL", "BASIC", "PARTNER"] as const;
export type AddonAudience = (typeof ADDON_AUDIENCES)[number];

export const INTAKE_FIELD_TYPES = ["TEXT", "NUMBER", "SELECT", "MULTISELECT", "DATE", "FILE", "BOOLEAN"] as const;
export type IntakeFieldType = (typeof INTAKE_FIELD_TYPES)[number];
export const INTAKE_SCOPES = ["ORDER", "LINE"] as const;
export type IntakeScope = (typeof INTAKE_SCOPES)[number];

export const DOCUMENT_TIMINGS = ["BEFORE_START", "DURING_WORK"] as const;

export const ORDER_STATUSES = ["DRAFT", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "REFUNDED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Every service runs through these; its own stages sit inside them as milestones. */
export const PROJECT_STATUSES = [
  "AWAITING_PAYMENT",
  "AWAITING_INFO",
  "SCHEDULED",
  "IN_PROGRESS",
  "IN_QA",
  "DELIVERED",
  "REVISION",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  AWAITING_INFO: "Awaiting information",
  SCHEDULED: "Visit scheduled",
  IN_PROGRESS: "In progress",
  IN_QA: "Quality check",
  DELIVERED: "Delivered",
  REVISION: "Revision",
  COMPLETED: "Completed",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
};
/** Statuses that count as open work. */
export const OPEN_PROJECT_STATUSES = [
  "AWAITING_PAYMENT",
  "AWAITING_INFO",
  "SCHEDULED",
  "IN_PROGRESS",
  "IN_QA",
  "DELIVERED",
  "REVISION",
  "ON_HOLD",
] as const satisfies readonly ProjectStatus[];
export const CLOSED_PROJECT_STATUSES = ["COMPLETED", "CANCELLED"] as const satisfies readonly ProjectStatus[];

export const PROJECT_HEALTH = ["ON_TRACK", "AT_RISK", "DELAYED"] as const;
export type ProjectHealth = (typeof PROJECT_HEALTH)[number];

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

export const VISIT_WINDOWS = ["AM", "PM"] as const;
export type VisitWindow = (typeof VISIT_WINDOWS)[number];
export const VISIT_KINDS = ["INITIAL", "ADDITIONAL", "MID_INSTALL", "POST_INSTALL"] as const;
export const VISIT_STATUSES = ["BOOKED", "COMPLETED", "NO_ACCESS", "CANCELLED"] as const;

export const DELIVERABLE_KINDS = ["PDF", "SPREADSHEET", "REPORT"] as const;
export const DELIVERABLE_STATUSES = ["PENDING", "IN_PROGRESS", "AVAILABLE"] as const;
export const DELIVERABLE_VERSION_LABELS = ["INITIAL", "REVISED", "FINAL"] as const;
export type DeliverableVersionLabel = (typeof DELIVERABLE_VERSION_LABELS)[number];

export const INVOICE_KINDS = ["ORDER", "WEEKLY", "SUBSCRIPTION", "CREDIT_TOPUP", "CHARGE"] as const;
export const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "OVERDUE", "VOID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const MEASURES = [
  { value: "EWI", label: "External wall insulation (EWI)" },
  { value: "IWI", label: "Internal wall insulation (IWI)" },
  { value: "CWI", label: "Cavity wall insulation (CWI)" },
  { value: "LI", label: "Loft insulation (LI)" },
  { value: "RIR", label: "Room-in-roof insulation (RIR)" },
  { value: "PRI", label: "Park home insulation (PRI)" },
  { value: "UNDERFLOOR", label: "Underfloor insulation" },
  { value: "BOILER", label: "Boiler" },
  { value: "HEATING_CONTROLS", label: "Heating controls" },
  { value: "ASHP", label: "Air source heat pump (ASHP)" },
  { value: "ESH", label: "Electric storage heaters (ESH)" },
  { value: "SOLAR_PV", label: "Solar PV" },
  { value: "VENTILATION", label: "Ventilation" },
] as const;

export const EMAIL_TEMPLATE_KEYS = [
  "project_update",
  "invite",
  "password_reset",
  "order_confirmation",
  "invoice_issued",
  "invoice_reminder",
  "account_hold",
  "hold_lifted",
  "partner_application",
  "partner_offer",
  "partner_activated",
  "credit_receipt",
] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

/** Upload rules for project documents (intake step 9). Per-requirement rules can narrow these. */
export const UPLOAD_RULES = {
  maxBytes: 25 * 1024 * 1024,
  mimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
};
/** Friendly names for the accepted types, used in error messages and requirement rows. */
export const FILE_TYPE_ALIASES: Record<string, string> = {
  PDF: "application/pdf",
  JPG: "image/jpeg",
  PNG: "image/png",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
