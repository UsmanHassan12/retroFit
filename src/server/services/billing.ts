import "server-only";

import type { AuthUser } from "../auth/session";
import { db } from "../db";
import { appUrl, integrations } from "../env";
import { notConfigured } from "../errors";
import { requireStripe, type Stripe } from "../integrations/stripe";
import { creditStatement, recordTopup } from "./credit";
import { ensureStripeCustomer } from "./customers";
import { activeHold, exposure, liftAutomaticHoldsIfSettled } from "./holds";
import { issueInvoice, listMyInvoices, markInvoicePaid, payInvoiceCheckout } from "./invoices";
import { confirmOrder, markRefunded } from "./orders";
import { activatePartnership, getMyPartnership, syncSubscription } from "./partners";
import { getSettings, type Settings } from "./settings";

/**
 * Billing for the signed-in customer, the tier comparison, and the Stripe webhook.
 * The old £29 "Priority plan" is gone: the paid tier is Premium Partner.
 */

/** Basic vs Premium Partner, with live values from settings (Billing → Plans, GET /api/plans). */
export function tierCatalogue(settings: Settings) {
  const discount = `${settings.partner.defaultDiscountBps / 100}%`;
  return [
    {
      id: "BASIC" as const,
      name: "Basic",
      pricePence: 0,
      tagline: "Homeowners, landlords and one-off buyers.",
      features: [
        { label: "List prices, pay by card at checkout", included: true },
        { label: "Standard turnaround", included: true },
        { label: "Express delivery available per order", included: true },
        { label: "Partner discount and priority queue", included: false },
      ],
    },
    {
      id: "PARTNER" as const,
      name: "Premium Partner",
      pricePence: settings.partner.subscriptionPence,
      tagline: "Installers, contractors, managing agents and housing associations with repeat work.",
      popular: true,
      features: [
        { label: `${discount} off list prices (set per partner)`, included: true },
        { label: "Fast-track turnaround; same-day desk calculations booked before " + settings.booking.sameDayCutoff, included: true },
        { label: "Pay in advance from credit, or one weekly invoice", included: true },
        { label: "Priority queue on every project", included: true },
      ],
    },
  ];
}

export async function getTierCatalogue() {
  return tierCatalogue(await getSettings());
}

export async function getBilling(user: AuthUser) {
  const [settings, invoices, partnership, credit, hold, money, record] = await Promise.all([
    getSettings(),
    listMyInvoices(user, 24),
    getMyPartnership(user),
    creditStatement(user.id, 20),
    activeHold(user.id),
    exposure(user.id),
    db.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } }),
  ]);

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
  const tiers = tierCatalogue(settings);
  const current = tiers.find((tier) => tier.id === user.tier)!;
  return {
    tier: user.tier,
    tierName: current.name,
    pricePence: current.pricePence,
    renewsAt: partnership.partner?.subscription.renewsAt ?? null,
    highlights: current.features.filter((feature) => feature.included).map((feature) => feature.label),
    partnership,
    paymentMode: partnership.partner?.status === "ACTIVE" ? partnership.partner.paymentMode : null,
    credit,
    hold: hold ? { reason: hold.reason, since: hold.startedAt.toISOString() } : null,
    outstanding: money,
    creditLimitPence: partnership.partner?.creditLimitPence ?? null,
    card,
    invoices,
  };
}

export async function billingPortal(user: AuthUser) {
  if (!integrations.stripe()) throw notConfigured("The billing portal needs Stripe. Set STRIPE_SECRET_KEY.");
  const session = await requireStripe().billingPortal.sessions.create({ customer: await ensureStripeCustomer(user), return_url: appUrl("/dashboard/billing") });
  return { url: session.url };
}

/** Settle an invoice and lift automatic holds when nothing is overdue any more. */
export async function settleInvoice(invoiceId: string, payment: { via: string; note?: string | null; paymentIntentId?: string | null; actorId?: string | null }) {
  const { invoice } = await markInvoicePaid(invoiceId, payment);
  await liftAutomaticHoldsIfSettled(invoice.userId);
  return invoice;
}

/** Customer pays an open invoice by card. */
export async function payInvoice(user: AuthUser, id: string) {
  const result = await payInvoiceCheckout(user, id, ensureStripeCustomer);
  if ("devPaid" in result && result.devPaid) await settleInvoice(id, { via: "CARD", note: "Development payment (no Stripe)" });
  return { url: result.url, paid: result.paid };
}

// ─── Stripe webhook ─────────────────────────────────────────────────────────

const toDate = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000) : null);

/** Period end lives on the subscription (older API versions) or its first item (newer ones). */
function periodEnd(subscription: Stripe.Subscription) {
  const legacy = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const item = (subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end;
  return toDate(legacy ?? item);
}

const intentId = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));

export async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const kind = session.metadata?.kind;
      if (session.mode === "payment" && session.payment_status === "paid") {
        const paymentIntentId = intentId(session.payment_intent as never);
        if (kind === "order" && session.metadata?.orderId) {
          const order = await db.order.findUnique({ where: { id: session.metadata.orderId }, select: { creditAppliedPence: true } });
          await confirmOrder(session.metadata.orderId, { method: order && order.creditAppliedPence > 0 ? "CREDIT_AND_CARD" : "CARD", paymentIntentId });
        } else if (kind === "topup" && session.metadata?.userId) {
          await recordTopup({ userId: session.metadata.userId, amountPence: session.amount_total ?? Number(session.metadata.amountPence), via: "CARD", paymentIntentId });
        } else if (kind === "invoice" && session.metadata?.invoiceId) {
          await settleInvoice(session.metadata.invoiceId, { via: "CARD", paymentIntentId });
        }
      }
      if (session.mode === "subscription" && kind === "partner_subscription" && session.metadata?.userId) {
        const subscriptionId = intentId(session.subscription as never);
        const subscription = subscriptionId ? await requireStripe().subscriptions.retrieve(subscriptionId) : null;
        await activatePartnership(session.metadata.userId, { subscriptionId, renewsAt: subscription ? periodEnd(subscription) : null, status: subscription?.status ?? "active" });
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription, periodEnd(subscription));
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription, null, true);
      break;
    }
    case "invoice.paid": {
      // Subscription renewals: keep a VAT receipt in the portal.
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId || !invoice.id) break;
      const user = await db.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
      if (!user) break;
      if (await db.invoice.findUnique({ where: { stripeInvoiceId: invoice.id } })) break;
      const settings = await getSettings();
      // The subscription is charged VAT-inclusive (see startSubscription), so split it here.
      const total = invoice.amount_paid;
      const tax = total - Math.round((total * 10_000) / (10_000 + settings.vat.rateBps));
      const created = await db.$transaction((tx) =>
        issueInvoice(tx, {
          userId: user.id,
          kind: "SUBSCRIPTION",
          status: "PAID",
          description: invoice.lines?.data?.[0]?.description ?? "Premium Partner subscription",
          lines: [{ description: invoice.lines?.data?.[0]?.description ?? "Premium Partner subscription", netPence: total - tax, vatPence: tax, totalPence: total }],
          paidAt: toDate(invoice.status_transitions?.paid_at) ?? new Date(),
          paidVia: "CARD",
          settings,
        }),
      );
      await db.invoice.update({ where: { id: created.id }, data: { stripeInvoiceId: invoice.id, pdfUrl: invoice.invoice_pdf ?? null } });
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntent = intentId(charge.payment_intent as never);
      if (paymentIntent) await markRefunded(paymentIntent, charge.amount_refunded >= charge.amount);
      break;
    }
    default:
      break;
  }
}

