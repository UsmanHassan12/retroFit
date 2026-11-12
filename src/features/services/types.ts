export const SERVICE_CATEGORIES = [
  { id: "assessment", label: "Assessment" },
  { id: "design", label: "Design" },
  { id: "coordination", label: "Coordination" },
  { id: "calculations", label: "Calculations" },
  { id: "surveys", label: "Surveys" },
  { id: "funding", label: "Funding" },
  { id: "compliance", label: "Compliance" },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]["id"];

/** List price per unit, excluding VAT. */
export const BUDGET_RANGES = [
  { id: "under-100", label: "Under £100", min: 0, max: 99.99 },
  { id: "100-300", label: "£100–£300", min: 100, max: 300 },
  { id: "300-plus", label: "£300+", min: 300.01, max: Number.POSITIVE_INFINITY },
] as const;

export type BudgetRange = (typeof BUDGET_RANGES)[number]["id"];

export type PriceUnit = "PROPERTY" | "ELEMENT" | "JUNCTION" | "VISIT" | "PACKAGE";

/** One list price per unit; the customer's tier decides discount, speed and payment terms. */
export type ServicePricing = {
  unit: PriceUnit;
  unitLabel: string;
  unitLabelPlural: string;
  /** GBP, excluding VAT. */
  listPrice: number;
  /** Quantity matters for per-element / per-junction / per-visit services. */
  perUnit: boolean;
  siteVisit: "NONE" | "REQUIRED" | "OPTIONAL";
  requiresProperty: boolean;
  revisionRounds: number;
};

export type ServiceAddOn = {
  /** Add-on key, used in the URL (?addons=express,extra-visit:2). */
  id: string;
  name: string;
  description: string;
  kind: "PERCENT_OF_LIST" | "PER_UNIT" | "PER_MILE" | "FIXED";
  /** GBP per unit / per mile / once; for PERCENT_OF_LIST the percentage. */
  amount: number;
  freeAllowance: number;
  audience: "ALL" | "BASIC" | "PARTNER";
  fastTrack: boolean;
  icon: "express" | "review" | "filing" | "training";
};

export type Milestone = { title: string; description: string };

export type ComplianceItem = {
  title: string;
  description: string;
  icon: "audit" | "shield" | "badge" | "file";
};

export type Deliverable = {
  title: string;
  description: string;
  icon: "report" | "certificate" | "package";
};

export type Service = {
  id: string;
  code: string;
  slug: string;
  /** Card title on listings. */
  title: string;
  /** Long H1 on the detail page. */
  headline: string;
  summary: string;
  intro: string;
  category: ServiceCategory;
  badge: "PAS 2035" | "Funding";
  schemes: string[];
  /** Basic turnaround, e.g. "5 working days after visit". */
  turnaround: string;
  /** Premium Partner turnaround (also what Express buys), or null when there's none. */
  fastTrackTurnaround: string | null;
  image: string;
  gallery: string[];
  pricing: ServicePricing;
  addOns: ServiceAddOn[];
  overview: { paragraphs: string[]; keyAreas: string[] };
  included: string[];
  timeline: Milestone[];
  compliance: ComplianceItem[];
  deliverables: Deliverable[];
};
