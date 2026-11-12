import "server-only";

import { requireUser } from "@/server/auth/session";
import { getAgreement } from "@/server/services/partners";
import { getBilling, getTierCatalogue } from "@/server/services/billing";

/** View models for Billing & Plans (prices in pounds). */

export type PlanView = {
  id: "basic" | "partner";
  name: string;
  price: number;
  tagline: string;
  features: { label: string; included: boolean }[];
  popular?: boolean;
};

export const getPlans = async (): Promise<PlanView[]> =>
  (await getTierCatalogue()).map((plan) => ({
    id: plan.id === "PARTNER" ? "partner" : "basic",
    name: plan.name,
    price: plan.pricePence / 100,
    tagline: plan.tagline,
    features: plan.features,
    popular: "popular" in plan ? plan.popular : undefined,
  }));

const STATUS_LABELS: Record<string, string> = { PAID: "Paid", ISSUED: "Due", OVERDUE: "Overdue", VOID: "Void", DRAFT: "Draft" };
const KIND_LABELS: Record<string, string> = { ORDER: "Booking receipt", WEEKLY: "Weekly invoice", SUBSCRIPTION: "Subscription", CREDIT_TOPUP: "Credit top-up", CHARGE: "Charge" };

export async function getSubscription() {
  const user = await requireUser();
  const billing = await getBilling(user);
  const partner = billing.partnership.partner;
  return {
    planId: (billing.tier === "PARTNER" ? "partner" : "basic") as PlanView["id"],
    planName: billing.tierName,
    price: billing.pricePence / 100,
    nextBillingDate: billing.renewsAt,
    highlights: billing.highlights,
    card: billing.card,
    nextStep: billing.partnership.nextStep,
    partner: partner
      ? {
          status: partner.status,
          companyName: partner.companyName,
          discountPercent: partner.discountBps / 100,
          paymentMode: partner.paymentMode,
          creditLimit: partner.creditLimitPence === null ? null : partner.creditLimitPence / 100,
          signed: Boolean(partner.agreement),
          subscriptionStatus: partner.subscription.status,
        }
      : null,
    agreement: billing.partnership.nextStep === "SIGN_AGREEMENT" ? await getAgreement(user) : null,
    paymentMode: billing.paymentMode,
    credit: { balance: billing.credit.balancePence / 100, entries: billing.credit.entries },
    outstanding: { unbilled: billing.outstanding.unbilledPence / 100, unpaid: billing.outstanding.unpaidPence / 100 },
    hold: billing.hold,
    invoices: billing.invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      kind: KIND_LABELS[invoice.kind] ?? invoice.kind,
      description: invoice.description,
      date: invoice.issuedAt,
      dueAt: invoice.dueAt,
      amount: invoice.totalPence / 100,
      status: STATUS_LABELS[invoice.status] ?? invoice.status,
      payable: (invoice.status === "ISSUED" || invoice.status === "OVERDUE") && invoice.totalPence > 0,
      viewUrl: invoice.viewUrl,
      pdfUrl: invoice.pdfUrl,
    })),
  };
}
export type SubscriptionView = Awaited<ReturnType<typeof getSubscription>>;
