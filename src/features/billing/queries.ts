import "server-only";

import { requireUser } from "@/server/auth/session";
import { getBilling, PLAN_CATALOGUE } from "@/server/services/billing";

/** View models for Billing & Plans (prices in pounds). */

export type PlanView = {
  id: "free" | "priority" | "enterprise";
  name: string;
  price: number;
  tagline: string;
  features: { label: string; included: boolean }[];
  popular?: boolean;
};

export const getPlans = async (): Promise<PlanView[]> =>
  PLAN_CATALOGUE.map((plan) => ({
    id: plan.id.toLowerCase() as PlanView["id"],
    name: plan.name,
    price: plan.pricePence / 100,
    tagline: plan.tagline,
    features: plan.features,
    popular: "popular" in plan ? plan.popular : undefined,
  }));

export async function getSubscription() {
  const billing = await getBilling(await requireUser());
  return {
    planId: billing.plan.toLowerCase() as PlanView["id"],
    planName: billing.planName,
    price: billing.pricePence / 100,
    nextBillingDate: billing.renewsAt,
    highlights: billing.highlights,
    card: billing.card,
    invoices: billing.invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      date: invoice.issuedAt,
      amount: invoice.amountPence / 100,
      status: invoice.status === "PAID" ? "Paid" : invoice.status === "OPEN" ? "Due" : "Void",
      pdfUrl: invoice.pdfUrl,
    })),
  };
}
