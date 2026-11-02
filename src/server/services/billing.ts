import "server-only";

import type { AuthUser } from "../auth/session";
import { db } from "../db";
import { appUrl, env, integrations, isProduction } from "../env";
import { AppError, notConfigured } from "../errors";
import { PRIORITY_PLAN_PRICE_PENCE, type Plan } from "../domain";
import { requireStripe, type Stripe } from "../integrations/stripe";
import { ensureStripeCustomer, fulfilOrder, markRefunded } from "./orders";
import { nextInvoiceNumber } from "./references";

/** Subscription plans shown on Billing → Plans. Prices in pence per month. */
export const PLAN_CATALOGUE = [
  {
    id: "FREE" as const,
    name: "Free",
    pricePence: 0,
    tagline: "Essential tools for individuals.",
    features: [
      { label: "Up to 2 projects", included: true },
      { label: "Basic PDF exports", included: true },
      { label: "Advanced analytics", included: false },
    ],
  },
  {
    id: "PRIORITY" as const,
    name: "Priority",
    pricePence: PRIORITY_PLAN_PRICE_PENCE,
    tagline: "Precision tools for growing teams.",
    popular: true,
    features: [
      { label: "Unlimited projects", included: true },
      { label: "Priority support", included: true },
      { label: "15% off every service", included: true },
    ],
  },
  {
    id: "ENTERPRISE" as const,
    name: "Enterprise",
    pricePence: 14_900,
    tagline: "Institutional-grade control.",
    features: [
      { label: "SSO & SAML", included: true },
      { label: "Custom API access", included: true },
      { label: "Dedicated account manager", included: true },
    ],
  },
];

export const PLAN_HIGHLIGHTS: Record<Plan, string[]> = {
  FREE: ["Up to 2 retrofit projects", "Basic PDF exports", "Email support"],
  PRIORITY: ["Unlimited retrofit projects", "15% off every service order", "Priority coordinator support"],
  ENTERPRISE: ["Unlimited projects and team seats", "SSO & custom API access", "Dedicated account manager"],
};

export async function getBilling(user: AuthUser) {
  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { plan: true, planRenewsAt: true, stripeCustomerId: true, invoices: { orderBy: { issuedAt: "desc" }, take: 24 } },
  });
  let card: { brand: string; last4: string; expires: string } | null = null;
  if (record?.stripeCustomerId && integrations.stripe()) {
    try {
      const methods = await requireStripe().paymentMethods.list({ customer: record.stripeCustomerId, type: "card", limit: 1 });
      const method = methods.data[0]?.card;
      if (method) card = { brand: method.brand, last4: method.last4, expires: `${String(method.exp_month).padStart(2, "0")}/${method.exp_year}` };
    } catch (error) {
      console.error("[billing] could not load payment method", error);
    }
  }
  const plan = (record?.plan ?? "FREE") as Plan;
  return {
    plan,
    planName: PLAN_CATALOGUE.find((item) => item.id === plan)!.name,
    pricePence: PLAN_CATALOGUE.find((item) => item.id === plan)!.pricePence,
    renewsAt: record?.planRenewsAt?.toISOString() ?? null,
    highlights: PLAN_HIGHLIGHTS[plan],
    card,
    invoices: (record?.invoices ?? []).map((invoice: any) => ({
      id: invoice.id as string,
      number: invoice.number as string,
      description: invoice.description as string,
      amountPence: invoice.amountPence as number,
      status: invoice.status as string,
      pdfUrl: (invoice.pdfUrl as string | null) ?? null,
      issuedAt: (invoice.issuedAt as Date).toISOString(),
    })),
  };
}

/** Start a Priority subscription. Without Stripe (dev) the plan is switched on immediately. */
export async function subscribe(user: AuthUser, plan: "PRIORITY") {
  if (user.plan === plan) throw new AppError("CONFLICT", "You're already on this plan.");

  if (!integrations.stripe()) {
    if (isProduction()) throw notConfigured("Payments are not configured.");
    await activatePlan(user.id, plan, new Date(Date.now() + 30 * 86_400_000), null);
    await db.$transaction(async (tx) =>
      tx.invoice.create({
        data: { userId: user.id, number: await nextInvoiceNumber(tx), description: "Priority plan (monthly)", amountPence: PRIORITY_PLAN_PRICE_PENCE, status: "PAID" },
      }),
    );
    return { url: appUrl("/dashboard/billing?subscribed=1") };
  }

  const price = env().STRIPE_PRICE_PRIORITY;
  if (!price) throw notConfigured("Set STRIPE_PRICE_PRIORITY to the Stripe price id of the Priority plan.");
  const session = await requireStripe().checkout.sessions.create({
    mode: "subscription",
    customer: await ensureStripeCustomer(user),
    client_reference_id: user.id,
    metadata: { userId: user.id, plan, kind: "subscription" },
    subscription_data: { metadata: { userId: user.id, plan } },
    line_items: [{ price, quantity: 1 }],
    success_url: appUrl("/dashboard/billing?subscribed=1"),
    cancel_url: appUrl("/dashboard/billing/plans"),
  });
  return { url: session.url! };
}

export async function billingPortal(user: AuthUser) {
  if (!integrations.stripe()) throw notConfigured("The billing portal needs Stripe. Set STRIPE_SECRET_KEY.");
  const session = await requireStripe().billingPortal.sessions.create({
    customer: await ensureStripeCustomer(user),
    return_url: appUrl("/dashboard/billing"),
  });
  return { url: session.url };
}

async function activatePlan(userId: string, plan: Plan, renewsAt: Date | null, subscriptionId: string | null) {
  await db.user.update({
    where: { id: userId },
    data: { plan, planRenewsAt: renewsAt, ...(subscriptionId !== null ? { stripeSubscriptionId: subscriptionId } : {}) },
  });
}

// ─── Stripe webhook ─────────────────────────────────────────────────────────

const toDate = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);

/** Period end lives on the subscription (older API versions) or its first item (newer ones). */
function periodEnd(subscription: Stripe.Subscription) {
  const legacy = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const item = (subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  return toDate(legacy ?? item);
}

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.orderId && session.payment_status === "paid") {
        const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
        await fulfilOrder(session.metadata.orderId, { paymentIntentId: paymentIntent });
      }
      if (session.mode === "subscription" && session.metadata?.userId) {
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
        let renewsAt: Date | null = null;
        if (subscriptionId) renewsAt = periodEnd(await requireStripe().subscriptions.retrieve(subscriptionId));
        await activatePlan(session.metadata.userId, (session.metadata.plan as Plan) ?? "PRIORITY", renewsAt, subscriptionId);
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const active = subscription.status === "active" || subscription.status === "trialing";
      await db.user.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: active ? { planRenewsAt: periodEnd(subscription) } : { plan: "FREE", planRenewsAt: null },
      });
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await db.user.updateMany({ where: { stripeSubscriptionId: subscription.id }, data: { plan: "FREE", planRenewsAt: null, stripeSubscriptionId: null } });
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId || !invoice.id) break;
      const user = await db.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
      if (!user) break;
      await db.$transaction(async (tx) => {
        const exists = await tx.invoice.findUnique({ where: { stripeInvoiceId: invoice.id! } });
        if (exists) return;
        await tx.invoice.create({
          data: {
            userId: user.id,
            number: invoice.number ?? (await nextInvoiceNumber(tx)),
            description: invoice.lines?.data?.[0]?.description ?? "Retrofit Portal subscription",
            amountPence: invoice.amount_paid,
            status: "PAID",
            stripeInvoiceId: invoice.id!,
            pdfUrl: invoice.invoice_pdf ?? null,
            issuedAt: toDate(invoice.created) ?? new Date(),
          },
        });
      });
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntent && charge.refunded) await markRefunded(paymentIntent);
      break;
    }
    default:
      break;
  }
}
