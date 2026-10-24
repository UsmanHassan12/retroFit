/** Billing seed data — replace with Stripe customer / subscription / invoice lookups. */

export type Plan = {
  id: "free" | "priority" | "enterprise";
  name: string;
  price: number;
  tagline: string;
  features: { label: string; included: boolean }[];
  popular?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "Essential tools for individuals.",
    features: [
      { label: "Up to 2 projects", included: true },
      { label: "Basic PDF exports", included: true },
      { label: "Advanced analytics", included: false },
    ],
  },
  {
    id: "priority",
    name: "Priority",
    price: 29,
    tagline: "Precision tools for growing teams.",
    popular: true,
    features: [
      { label: "Unlimited projects", included: true },
      { label: "Priority support", included: true },
      { label: "Advanced energy models", included: true },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 149,
    tagline: "Institutional-grade control.",
    features: [
      { label: "SSO & SAML", included: true },
      { label: "Custom API access", included: true },
      { label: "Dedicated account manager", included: true },
    ],
  },
];

export const SUBSCRIPTION = {
  planId: "priority" as Plan["id"],
  nextBillingDate: "2026-11-12",
  highlights: ["Unlimited retrofit projects", "Advanced energy efficiency analytics", "Team collaboration (up to 10 members)"],
  card: { brand: "Visa", last4: "4242", expires: "12/2027" },
};

export const INVOICES = [
  { id: "INV-1026", date: "2026-10-12", amount: 29, status: "Paid" as const },
  { id: "INV-0926", date: "2026-09-12", amount: 29, status: "Paid" as const },
  { id: "INV-0826", date: "2026-08-12", amount: 29, status: "Paid" as const },
  { id: "INV-0726", date: "2026-07-12", amount: 29, status: "Paid" as const },
  { id: "INV-0626", date: "2026-06-12", amount: 29, status: "Paid" as const },
  { id: "INV-0526", date: "2026-05-12", amount: 29, status: "Paid" as const },
];
