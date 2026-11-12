import "server-only";

import { z } from "zod";

import type { AuthUser } from "../auth/session";
import { db } from "../db";
import { appUrl, integrations, isProduction } from "../env";
import { badRequest, conflict, notConfigured, notFound } from "../errors";
import { CUSTOMER_TYPES, PARTNER_STATUSES, PAYMENT_MODES } from "../domain";
import { sendEmail, sendTemplate } from "../integrations/email";
import { requireStripe, type Stripe } from "../integrations/stripe";
import { formatPence } from "../rules/pricing";
import { audit } from "./audit";
import { creditBalance } from "./credit";
import { ensureStripeCustomer } from "./customers";
import { exposure, listHolds } from "./holds";
import { issueInvoice } from "./invoices";
import { getSettings, type Settings } from "./settings";

/**
 * Premium Partner lifecycle (catalogue doc → "Customer tiers", agreement draft):
 *   1. self sign-up as Basic, then apply                         → APPLIED
 *   2. admin approves: discount, payment mode, credit limit       → OFFERED
 *   3. partner signs the agreement online (name, date, IP, version)
 *   4. partner starts the £199/month subscription                 → ACTIVE (tier PARTNER)
 * Admin can suspend or cancel; a cancelled Stripe subscription cancels the partnership.
 * Discount changes apply to new bookings only (orders keep their snapshots).
 */

const toPartnerDto = (profile: any) => ({
  id: profile.id as string,
  userId: profile.userId as string,
  companyName: profile.companyName as string,
  companyNumber: (profile.companyNumber as string | null) ?? null,
  vatNumber: (profile.vatNumber as string | null) ?? null,
  trustmarkLicence: (profile.trustmarkLicence as string | null) ?? null,
  status: profile.status as (typeof PARTNER_STATUSES)[number],
  discountBps: profile.discountBps as number,
  paymentMode: profile.paymentMode as (typeof PAYMENT_MODES)[number],
  creditLimitPence: (profile.creditLimitPence as number | null) ?? null,
  applicationNote: (profile.applicationNote as string | null) ?? null,
  adminNotes: (profile.adminNotes as string | null) ?? null,
  agreement: profile.agreementSignedAt
    ? { version: profile.agreementVersion as string, signedAt: (profile.agreementSignedAt as Date).toISOString(), signedName: profile.agreementSignedName as string }
    : null,
  subscription: { status: (profile.subscriptionStatus as string | null) ?? null, renewsAt: profile.subscriptionRenewsAt ? (profile.subscriptionRenewsAt as Date).toISOString() : null },
  serviceDiscounts: (profile.serviceDiscounts ?? []).map((row: any) => ({ serviceId: row.serviceId as string, discountBps: row.discountBps as number })),
  appliedAt: (profile.appliedAt as Date).toISOString(),
  approvedAt: profile.approvedAt ? (profile.approvedAt as Date).toISOString() : null,
  activatedAt: profile.activatedAt ? (profile.activatedAt as Date).toISOString() : null,
});
export type PartnerDto = ReturnType<typeof toPartnerDto>;

/** What the partner should do next, for the UI. */
function nextStep(profile: PartnerDto | null) {
  if (!profile || profile.status === "REJECTED" || profile.status === "CANCELLED") return "APPLY" as const;
  if (profile.status === "APPLIED") return "WAIT_FOR_APPROVAL" as const;
  if (profile.status === "OFFERED") return profile.agreement ? ("SUBSCRIBE" as const) : ("SIGN_AGREEMENT" as const);
  if (profile.status === "SUSPENDED") return "CONTACT_US" as const;
  return "NONE" as const;
}

// ─── Partner side ───────────────────────────────────────────────────────────

export const applySchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company name.").max(120),
  companyNumber: z.string().trim().max(20).optional(),
  vatNumber: z.string().trim().max(20).optional(),
  trustmarkLicence: z.string().trim().max(40).optional(),
  customerType: z.enum(CUSTOMER_TYPES).default("INSTALLER"),
  phone: z.string().trim().max(30).optional(),
  note: z.string().trim().max(1_000).optional(),
});

export async function applyForPartnership(user: AuthUser, input: z.input<typeof applySchema>) {
  const data = applySchema.parse(input);
  if (user.role !== "CLIENT") throw badRequest("Staff accounts can't become partners.");
  const settings = await getSettings();
  const existing = await db.partnerProfile.findUnique({ where: { userId: user.id } });
  if (existing && ["APPLIED", "OFFERED", "ACTIVE", "SUSPENDED"].includes(existing.status)) throw conflict("You already have a partner application.");

  const fields = {
    companyName: data.companyName,
    companyNumber: data.companyNumber || null,
    vatNumber: data.vatNumber || null,
    trustmarkLicence: data.trustmarkLicence || null,
    applicationNote: data.note || null,
    status: "APPLIED" as const,
    discountBps: settings.partner.defaultDiscountBps,
    appliedAt: new Date(),
    approvedAt: null,
    agreementSignedAt: null,
    agreementSignedName: null,
    agreementSignedIp: null,
    agreementVersion: null,
  };
  const profile = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { companyName: data.companyName, customerType: data.customerType, ...(data.phone ? { phone: data.phone } : {}) } });
    return tx.partnerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...fields }, update: fields, include: { serviceDiscounts: true } });
  });

  const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { email: true } });
  for (const admin of admins) {
    await sendTemplate("partner_application", admin.email, { company: data.companyName, user_email: user.email, link: appUrl(`/admin/partners/${profile.id}`) });
  }
  return toPartnerDto(profile);
}

export async function getMyPartnership(user: AuthUser) {
  const [profile, settings] = await Promise.all([db.partnerProfile.findUnique({ where: { userId: user.id }, include: { serviceDiscounts: true } }), getSettings()]);
  const dto = profile ? toPartnerDto(profile) : null;
  return {
    partner: dto,
    nextStep: nextStep(dto),
    subscriptionPence: settings.partner.subscriptionPence,
    agreementVersion: settings.partner.agreementVersion,
  };
}

/** The agreement text for the partner's offer, with their terms filled in. */
export async function getAgreement(user: AuthUser) {
  const profile = await db.partnerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw notFound("Partner application");
  const settings = await getSettings();
  return { version: settings.partner.agreementVersion, clauses: agreementClauses(profile, settings) };
}

export const signSchema = z.object({
  fullName: z.string().trim().min(3, "Type your full name to sign.").max(120),
  accept: z.literal(true, { message: "Tick to accept the agreement." }),
  version: z.string().min(1),
});

/** E-signature: name, date, IP address and agreement version are stored (draft terms, intro). */
export async function signAgreement(user: AuthUser, input: z.input<typeof signSchema>, meta: { ip?: string | null }) {
  const data = signSchema.parse(input);
  const settings = await getSettings();
  if (data.version !== settings.partner.agreementVersion) throw conflict("The agreement has been updated. Please read the latest version.");
  const profile = await db.partnerProfile.findUnique({ where: { userId: user.id } });
  if (!profile || profile.status !== "OFFERED") throw conflict("There's no partner offer waiting for your signature.");
  const updated = await db.partnerProfile.update({
    where: { id: profile.id },
    data: { agreementVersion: data.version, agreementSignedAt: new Date(), agreementSignedName: data.fullName, agreementSignedIp: meta.ip ?? null },
    include: { serviceDiscounts: true },
  });
  await audit(user.id, "partner.sign", "PartnerProfile", profile.id, { version: data.version, ip: meta.ip });
  return toPartnerDto(updated);
}

/** Start the monthly subscription (Stripe Checkout). Without Stripe in dev the partner is activated at once. */
export async function startSubscription(user: AuthUser) {
  const settings = await getSettings();
  const profile = await db.partnerProfile.findUnique({ where: { userId: user.id } });
  if (!profile || profile.status !== "OFFERED") throw conflict("Your partner account isn't ready for a subscription yet.");
  if (!profile.agreementSignedAt || profile.agreementVersion !== settings.partner.agreementVersion) throw conflict("Please sign the partner agreement first.");

  if (!integrations.stripe()) {
    if (isProduction()) throw notConfigured("Payments are not configured.");
    await activatePartnership(user.id, { subscriptionId: null, renewsAt: new Date(Date.now() + 30 * 86_400_000), status: "active" });
    const vat = Math.round((settings.partner.subscriptionPence * settings.vat.rateBps) / 10_000);
    await db.$transaction((tx) =>
      issueInvoice(tx, {
        userId: user.id,
        kind: "SUBSCRIPTION",
        status: "PAID",
        description: "Premium Partner subscription (monthly)",
        lines: [{ description: "Premium Partner subscription — 1 month", netPence: settings.partner.subscriptionPence, vatPence: vat, totalPence: settings.partner.subscriptionPence + vat }],
        paidVia: "CARD",
        settings,
      }),
    );
    return { url: appUrl("/dashboard/billing?partner=active"), paid: true };
  }

  const session = await requireStripe().checkout.sessions.create({
    mode: "subscription",
    customer: await ensureStripeCustomer(user),
    client_reference_id: user.id,
    metadata: { kind: "partner_subscription", userId: user.id },
    subscription_data: { metadata: { kind: "partner_subscription", userId: user.id } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          // £199 + VAT, charged VAT-inclusive so no Stripe Tax set-up is needed.
          unit_amount: settings.partner.subscriptionPence + Math.round((settings.partner.subscriptionPence * settings.vat.rateBps) / 10_000),
          recurring: { interval: "month" },
          product_data: { name: `Retrofit Portal Premium Partner (${formatPence(settings.partner.subscriptionPence)} + VAT)` },
        },
      },
    ],
    success_url: appUrl("/dashboard/billing?partner=active"),
    cancel_url: appUrl("/dashboard/billing/plans"),
  });
  return { url: session.url!, paid: false };
}

/** Called by the Stripe webhook (or the dev shortcut) once the subscription is live. */
export async function activatePartnership(userId: string, subscription: { subscriptionId: string | null; renewsAt: Date | null; status: string }) {
  const profile = await db.partnerProfile.findUnique({ where: { userId }, include: { user: { select: { email: true, firstName: true } } } });
  if (!profile) return;
  if (profile.status === "ACTIVE" && profile.stripeSubscriptionId === subscription.subscriptionId) return;
  await db.partnerProfile.update({
    where: { id: profile.id },
    data: {
      status: "ACTIVE",
      activatedAt: profile.activatedAt ?? new Date(),
      stripeSubscriptionId: subscription.subscriptionId,
      subscriptionStatus: subscription.status,
      subscriptionRenewsAt: subscription.renewsAt,
    },
  });
  await sendTemplate("partner_activated", profile.user.email, { user_name: profile.user.firstName, company: profile.companyName, link: appUrl("/dashboard") });
}

/** Stripe subscription status changes. */
export async function syncSubscription(subscription: Stripe.Subscription, renewsAt: Date | null, deleted = false) {
  const profile = await db.partnerProfile.findUnique({ where: { stripeSubscriptionId: subscription.id } });
  if (!profile) return;
  const lapsed = deleted || ["canceled", "unpaid", "incomplete_expired"].includes(subscription.status);
  await db.partnerProfile.update({
    where: { id: profile.id },
    data: {
      subscriptionStatus: deleted ? "canceled" : subscription.status,
      subscriptionRenewsAt: lapsed ? null : renewsAt,
      ...(lapsed && profile.status === "ACTIVE" ? { status: deleted ? ("CANCELLED" as const) : ("SUSPENDED" as const) } : {}),
      ...(!lapsed && profile.status === "SUSPENDED" && ["active", "trialing"].includes(subscription.status) ? { status: "ACTIVE" as const } : {}),
      ...(deleted ? { stripeSubscriptionId: null } : {}),
    },
  });
}

/** Partner gives notice (30 days by default): the subscription ends at that point. */
export async function cancelSubscription(user: AuthUser) {
  const settings = await getSettings();
  const profile = await db.partnerProfile.findUnique({ where: { userId: user.id } });
  if (!profile || profile.status !== "ACTIVE") throw conflict("You don't have an active partner subscription.");
  const endsAt = new Date(Date.now() + settings.partner.noticeDays * 86_400_000);
  if (profile.stripeSubscriptionId && integrations.stripe()) {
    await requireStripe().subscriptions.update(profile.stripeSubscriptionId, { cancel_at: Math.floor(endsAt.getTime() / 1000) });
    await db.partnerProfile.update({ where: { id: profile.id }, data: { subscriptionStatus: "cancelling", subscriptionRenewsAt: endsAt } });
  } else {
    await db.partnerProfile.update({ where: { id: profile.id }, data: { status: "CANCELLED", subscriptionStatus: "canceled", subscriptionRenewsAt: null } });
  }
  await audit(user.id, "partner.cancel", "PartnerProfile", profile.id, { endsAt: endsAt.toISOString() });
  return { endsAt: endsAt.toISOString() };
}

// ─── Admin side ─────────────────────────────────────────────────────────────

export const partnerFiltersSchema = z.object({ status: z.enum(PARTNER_STATUSES).optional(), q: z.string().trim().max(100).optional() });

export async function adminListPartners(input: Record<string, string> = {}) {
  const filters = partnerFiltersSchema.parse(input);
  const partners = await db.partnerProfile.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q ? { OR: [{ companyName: { contains: filters.q, mode: "insensitive" as const } }, { user: { email: { contains: filters.q, mode: "insensitive" as const } } }] } : {}),
    },
    include: { serviceDiscounts: true, user: { select: { email: true, firstName: true, lastName: true, phone: true } } },
    orderBy: [{ status: "asc" }, { appliedAt: "desc" }],
    take: 200,
  });
  return partners.map((profile: any) => ({ ...toPartnerDto(profile), contact: { email: profile.user.email as string, name: `${profile.user.firstName} ${profile.user.lastName}`.trim(), phone: (profile.user.phone as string | null) ?? null } }));
}

export async function adminGetPartner(id: string) {
  const profile = await db.partnerProfile.findUnique({ where: { id }, include: { serviceDiscounts: true, user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } } } });
  if (!profile) throw notFound("Partner");
  const [balancePence, money, holds] = await Promise.all([creditBalance(profile.userId), exposure(profile.userId), listHolds(profile.userId)]);
  return {
    ...toPartnerDto(profile),
    contact: { userId: profile.user.id, email: profile.user.email, name: `${profile.user.firstName} ${profile.user.lastName}`.trim(), phone: profile.user.phone },
    creditBalancePence: balancePence,
    exposure: money,
    holds,
  };
}

const termsSchema = z.object({
  discountBps: z.number().int().min(0).max(10_000),
  paymentMode: z.enum(PAYMENT_MODES),
  creditLimitPence: z.number().int().min(0).nullable(),
});

export const offerSchema = termsSchema.partial({ creditLimitPence: true }).extend({ discountBps: z.number().int().min(0).max(10_000).optional() });

function assertDiscountInRange(bps: number, settings: Settings) {
  if (bps < settings.partner.minDiscountBps || bps > settings.partner.maxDiscountBps) {
    throw badRequest(`Partner discount must be between ${settings.partner.minDiscountBps / 100}% and ${settings.partner.maxDiscountBps / 100}%.`);
  }
}

/** Approve an application with terms → OFFERED, and email the partner to sign. */
export async function offerTerms(actorId: string, id: string, input: z.input<typeof offerSchema>) {
  const data = offerSchema.parse(input);
  const settings = await getSettings();
  const discountBps = data.discountBps ?? settings.partner.defaultDiscountBps;
  assertDiscountInRange(discountBps, settings);
  const profile = await db.partnerProfile.findUnique({ where: { id }, include: { user: { select: { email: true, firstName: true } } } });
  if (!profile) throw notFound("Partner");
  if (profile.status !== "APPLIED") throw conflict("Only new applications can be approved.");
  const creditLimitPence = data.creditLimitPence !== undefined ? data.creditLimitPence : data.paymentMode === "WEEKLY" ? settings.partner.defaultCreditLimitPence : null;
  const updated = await db.partnerProfile.update({
    where: { id },
    data: { status: "OFFERED", discountBps, paymentMode: data.paymentMode, creditLimitPence, approvedAt: new Date(), approvedById: actorId },
    include: { serviceDiscounts: true },
  });
  await sendTemplate("partner_offer", profile.user.email, {
    user_name: profile.user.firstName,
    company: profile.companyName,
    discount: `${discountBps / 100}%`,
    payment_mode: data.paymentMode === "WEEKLY" ? "weekly invoice" : "pay in advance (account credit)",
    fee: formatPence(settings.partner.subscriptionPence),
    link: appUrl("/dashboard/billing/plans"),
  });
  await audit(actorId, "partner.offer", "PartnerProfile", id, { discountBps, paymentMode: data.paymentMode, creditLimitPence });
  return toPartnerDto(updated);
}

export const partnerPatchSchema = z
  .object({
    discountBps: z.number().int().min(0).max(10_000),
    paymentMode: z.enum(PAYMENT_MODES),
    creditLimitPence: z.number().int().min(0).nullable(),
    status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED", "REJECTED"]),
    adminNotes: z.string().trim().max(2_000).nullable(),
    companyName: z.string().trim().min(2).max(120),
    vatNumber: z.string().trim().max(20).nullable(),
    trustmarkLicence: z.string().trim().max(40).nullable(),
  })
  .partial();

/** Change terms or status. New terms apply to new bookings only. */
export async function updatePartner(actorId: string, id: string, input: z.input<typeof partnerPatchSchema>) {
  const data = partnerPatchSchema.parse(input);
  const settings = await getSettings();
  if (data.discountBps !== undefined) assertDiscountInRange(data.discountBps, settings);
  const profile = await db.partnerProfile.findUnique({ where: { id } });
  if (!profile) throw notFound("Partner");
  if (data.status === "ACTIVE" && profile.status !== "SUSPENDED") throw conflict("Only a suspended partner can be re-activated here. New partners activate by subscribing.");
  if (data.status === "REJECTED" && profile.status !== "APPLIED") throw conflict("Only applications can be rejected.");
  const updated = await db.partnerProfile.update({ where: { id }, data, include: { serviceDiscounts: true } });
  if (data.status === "CANCELLED" && profile.stripeSubscriptionId && integrations.stripe()) {
    await requireStripe().subscriptions.cancel(profile.stripeSubscriptionId).catch((error: unknown) => console.error("[partners] cancel subscription", error));
  }
  if (data.status && data.status !== profile.status) {
    const user = await db.user.findUnique({ where: { id: profile.userId }, select: { email: true } });
    if (user) await sendEmail({ to: user.email, subject: `Your Premium Partner account is now ${data.status.toLowerCase()}`, html: `<p>Your Premium Partner account status changed to <strong>${data.status.toLowerCase()}</strong>. Contact us if you have questions.</p>` });
  }
  await audit(actorId, "partner.update", "PartnerProfile", id, data);
  return toPartnerDto(updated);
}

export const serviceDiscountsSchema = z.array(z.object({ serviceId: z.string().min(1), discountBps: z.number().int().min(0).max(10_000).nullable() }));

/** Set per-service overrides (null removes an override). */
export async function setServiceDiscounts(actorId: string, id: string, input: z.input<typeof serviceDiscountsSchema>) {
  const rows = serviceDiscountsSchema.parse(input);
  const settings = await getSettings();
  for (const row of rows) if (row.discountBps !== null) assertDiscountInRange(row.discountBps, settings);
  const profile = await db.partnerProfile.findUnique({ where: { id }, select: { id: true } });
  if (!profile) throw notFound("Partner");
  const services = await db.service.count({ where: { id: { in: rows.map((row) => row.serviceId) } } });
  if (services !== new Set(rows.map((row) => row.serviceId)).size) throw badRequest("Unknown service.");
  await db.$transaction(async (tx) => {
    for (const row of rows) {
      if (row.discountBps === null) await tx.partnerServiceDiscount.deleteMany({ where: { partnerId: id, serviceId: row.serviceId } });
      else
        await tx.partnerServiceDiscount.upsert({
          where: { partnerId_serviceId: { partnerId: id, serviceId: row.serviceId } },
          create: { partnerId: id, serviceId: row.serviceId, discountBps: row.discountBps },
          update: { discountBps: row.discountBps },
        });
    }
  });
  await audit(actorId, "partner.service_discounts", "PartnerProfile", id, { rows });
  return adminGetPartner(id);
}

// ─── Agreement text (draft, to be finalised by StepSoft's solicitor) ─────────

function agreementClauses(profile: { companyName: string; discountBps: number; paymentMode: string; creditLimitPence: number | null }, settings: Settings) {
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][settings.billing.cutoffWeekday];
  const c = settings.cancellation;
  return [
    { title: "Parties", text: `${settings.seller.name} (trading as ${settings.seller.tradingAs}) and ${profile.companyName}.` },
    { title: "Term", text: `Rolling monthly from activation. Either side can end it with ${settings.partner.noticeDays} days' written notice. StepSoft can end it immediately for non-payment beyond 14 days or a serious breach.` },
    { title: "Subscription", text: `${formatPence(settings.partner.subscriptionPence)} per month plus VAT, charged in advance on the activation date each month. It is non-refundable for a part month.` },
    { title: "Partner discount", text: `${profile.discountBps / 100}% off list prices at booking. StepSoft can change it with 30 days' notice; the change does not affect existing orders.` },
    { title: "Fast-track delivery", text: "The partner turnaround shown per service, counted in working days from complete intake or the site visit. It does not apply while information is missing, the account is on hold, or the site is not accessible." },
    { title: "Payment mode", text: profile.paymentMode === "WEEKLY" ? "Weekly invoice, as approved by StepSoft. StepSoft can move a partner from weekly to advance after a late payment." : "Pay in advance from prepaid account credit. Unused credit is refundable on cancellation." },
    { title: "Weekly invoices", text: `Issued every ${weekday} at ${settings.billing.cutoffTime} UK time for orders booked that week, and payable by ${settings.billing.dueTime} ${settings.billing.dueDaysAfterCutoff} days later.` },
    { title: "Late payment and account hold", text: "If payment is late the account is placed on hold: new bookings are blocked, open work pauses and deliverables are withheld until it is paid in full. Statutory late-payment interest may be charged under the Late Payment of Commercial Debts (Interest) Act 1998. Turnaround times restart once the hold is lifted." },
    { title: "Credit limit", text: profile.creditLimitPence !== null ? `Unpaid plus unbilled work is limited to ${formatPence(profile.creditLimitPence)}; bookings above it require payment first.` : "No credit limit is set." },
    { title: "Partner obligations", text: "Supply accurate property and occupant data; hold valid TrustMark and PAS 2030 certification where required; obtain occupant consent for visits and data sharing; provide site access; upload installation evidence on time." },
    { title: "Cancellations", text: `Free before the visit is booked or work starts; ${c.workStartedPercent}% of the service price once work has started or within ${c.withinHoursOfVisit} hours of a visit; ${c.deliveredPercent}% once delivered. Failed visits (no access) are charged at ${formatPence(c.failedVisitPence)}.` },
    { title: "Revisions", text: "Two revision rounds are included per service unless stated otherwise. Changes in scope are quoted separately." },
    { title: "Data protection", text: "UK GDPR. StepSoft is the controller for portal account data and the processor for occupant data supplied by the partner. Data is shared with TrustMark, scheme administrators and funders only as needed for compliance." },
    { title: "Liability", text: "Limited to the fees paid for the affected service. Funding approval by an energy supplier or scheme administrator is not guaranteed." },
    { title: "Non-solicitation", text: "The partner will not directly engage StepSoft's assessors, designers or coordinators during the agreement and for 6 months after it ends." },
    { title: "Governing law", text: "England and Wales." },
  ];
}

