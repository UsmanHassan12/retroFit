export const SERVICE_CATEGORIES = [
  { id: "assessment", label: "Assessment" },
  { id: "design", label: "Design" },
  { id: "coordination", label: "Coordination" },
  { id: "full-package", label: "Full Package" },
  { id: "funding", label: "Funding" },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]["id"];

export const BUDGET_RANGES = [
  { id: "under-500", label: "Under £500", min: 0, max: 499.99 },
  { id: "500-1000", label: "£500–£1000", min: 500, max: 1000 },
  { id: "1000-plus", label: "£1000+", min: 1000.01, max: Number.POSITIVE_INFINITY },
] as const;

export type BudgetRange = (typeof BUDGET_RANGES)[number]["id"];

export type TierId = "basic" | "standard" | "premium";

export type ServiceTier = {
  id: TierId;
  name: string;
  /** Price in GBP, excluding VAT. */
  price: number;
  summary: string;
  deliveryDays: number;
  inclusions: string[];
  /** Short feature list shown on the order review card. */
  highlights: string[];
};

export type ServiceAddOn = {
  id: string;
  name: string;
  description: string;
  price: number;
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
  slug: string;
  /** Card title on listings. */
  title: string;
  /** Long H1 on the detail page. */
  headline: string;
  summary: string;
  intro: string;
  category: ServiceCategory;
  badge: "PAS 2035" | "Funding";
  schemes: Array<"ECO4" | "GBIS">;
  turnaround: string;
  image: string;
  gallery: string[];
  tiers: ServiceTier[];
  addOns: ServiceAddOn[];
  overview: { paragraphs: string[]; keyAreas: string[] };
  included: string[];
  timeline: Milestone[];
  compliance: ComplianceItem[];
  deliverables: Deliverable[];
};
