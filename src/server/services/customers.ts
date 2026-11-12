import "server-only";

import type { AuthUser } from "../auth/session";
import { db, type Tx } from "../db";
import type { CustomerTier, PaymentMethod, PaymentMode } from "../domain";
import { requireStripe } from "../integrations/stripe";
import { partnerDiscountBps } from "../rules/pricing";
import type { Settings } from "./settings";

/**
 * Who is buying, commercially: tier, partner terms and per-service discounts. Read fresh for
 * every quote and booking so a change by admin applies to the next order (never to existing
 * ones, which keep their snapshots).
 */
export type CustomerContext = {
  userId: string | null;
  tier: CustomerTier;
  customerType: string | null;
  partner: {
    id: string;
    discountBps: number;
    paymentMode: PaymentMode;
    creditLimitPence: number | null;
    overrides: Map<string, number>;
  } | null;
};

export const ANONYMOUS: CustomerContext = { userId: null, tier: "BASIC", customerType: null, partner: null };

export async function getCustomerContext(userId: string | null | undefined, client: Tx | typeof db = db): Promise<CustomerContext> {
  if (!userId) return ANONYMOUS;
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, customerType: true, partnerProfile: { include: { serviceDiscounts: true } } },
  });
  if (!user) return ANONYMOUS;
  const profile = user.partnerProfile;
  const active = profile?.status === "ACTIVE";
  return {
    userId: user.id,
    tier: active ? "PARTNER" : "BASIC",
    customerType: (user.customerType as string | null) ?? null,
    partner: active
      ? {
          id: profile!.id,
          discountBps: profile!.discountBps,
          paymentMode: profile!.paymentMode as PaymentMode,
          creditLimitPence: profile!.creditLimitPence,
          overrides: new Map(profile!.serviceDiscounts.map((row: { serviceId: string; discountBps: number }) => [row.serviceId, row.discountBps])),
        }
      : null,
  };
}

/** Partner discount for a service under the current settings (0 for Basic). */
export function discountFor(context: CustomerContext, serviceId: string | null, settings: Settings) {
  if (!context.partner) return 0;
  return partnerDiscountBps({
    defaultBps: context.partner.discountBps,
    overrideBps: serviceId ? context.partner.overrides.get(serviceId) : undefined,
    minBps: settings.partner.minDiscountBps,
    maxBps: settings.partner.maxDiscountBps,
  });
}

/** Payment methods the customer may use at checkout (catalogue doc → "Payment and invoicing rules"). */
export function paymentMethodsFor(context: CustomerContext): PaymentMethod[] {
  if (!context.partner) return ["CARD"];
  return context.partner.paymentMode === "WEEKLY" ? ["WEEKLY_INVOICE", "CARD"] : ["CREDIT", "CREDIT_AND_CARD", "CARD"];
}

export async function ensureStripeCustomer(user: Pick<AuthUser, "id" | "email" | "name">) {
  const stripe = requireStripe();
  const record = await db.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true, companyName: true } });
  if (record?.stripeCustomerId) return record.stripeCustomerId as string;
  const customer = await stripe.customers.create({ email: user.email, name: record?.companyName || user.name, metadata: { userId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}
