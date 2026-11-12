import "server-only";

import { z } from "zod";

import type { AuthUser } from "../auth/session";
import { displayName } from "../auth/session";
import { db } from "../db";
import { appUrl, integrations, isProduction } from "../env";
import { AppError, badRequest, conflict, notConfigured, notFound } from "../errors";
import { PAYMENT_METHODS, type CustomerTier, type PaymentMethod } from "../domain";
import { sendTemplate } from "../integrations/email";
import { requireStripe } from "../integrations/stripe";
import { dueDate, zonedTime, ymdOf } from "../rules/calendar";
import { allocateBundle, chooseDiscount, formatPence, percentToBps, priceLine, sumLines, type AddonInput, type LinePrice } from "../rules/pricing";
import { propertySchema } from "./account";
import { postcodeArea } from "./availability";
import { addCreditEntry, creditBalance } from "./credit";
import { ANONYMOUS, discountFor, ensureStripeCustomer, getCustomerContext, paymentMethodsFor, type CustomerContext } from "./customers";
import { assertCanBook } from "./holds";
import { checkAnswers, commonQuestions, intakeFacts, serviceQuestions } from "./intake";
import { issueInvoice } from "./invoices";
import { nextOrderReference } from "./references";
import { getBankHolidays, getSettings } from "./settings";
import { createProjectsForOrder } from "./workflow";

/**
 * Bookings. One order = one or more lines; each line is one service for one property (or one
 * package) and becomes a project once the order is confirmed. A partner can book one service
 * for many properties (bulk CSV), or a bundle ("Assessment + Design + Coordination").
 *
 * Pricing happens here, server-side only: list → partner discount (or code) → add-ons → VAT,
 * every figure snapshotted on the line. Payment depends on the customer tier:
 *   Basic            card, in full, at checkout; the project starts once payment succeeds
 *   Partner ADVANCE  account credit; card for the shortfall, or card for everything
 *   Partner WEEKLY   added to this week's invoice (subject to the credit limit), or card
 */

// ─── Input ──────────────────────────────────────────────────────────────────

const addonSelection = z.object({
  key: z.string().trim().min(1),
  /** Visits for "additional site visit", miles for "travel". */
  quantity: z.number().int().min(0).max(100_000).optional(),
});

const lineSchema = z.object({
  /** Service id, code ("RA") or slug. Ignored for bundle orders. */
  serviceId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  /** A new property, saved to the customer's account when the order is created. */
  property: propertySchema.optional(),
  /** Elements, junctions or visits; always 1 for per-property and per-package services. */
  quantity: z.number().int().min(1).max(1_000).default(1),
  addons: z.array(addonSelection).max(10).default([]),
  /** Answers to this service's questions. */
  answers: z.record(z.string(), z.unknown()).default({}),
  /** Visit slot from GET /api/availability. */
  availabilityId: z.string().trim().min(1).optional(),
});

export const quoteSchema = z.object({
  /** Book a bundle: each line is then a property, expanded into the bundle's services. */
  bundleId: z.string().trim().min(1).optional(),
  lines: z.array(lineSchema).min(1, "Add at least one item.").max(5_000),
  /** Answers to the common (ORDER-scope) questions: funding, installer, measures… */
  answers: z.record(z.string(), z.unknown()).default({}),
  discountCode: z.string().trim().max(32).optional(),
});

export const createOrderSchema = quoteSchema.extend({
  consent: z.object({
    acceptTerms: z.literal(true, { message: "Please accept the terms to continue." }),
    gdprConsent: z.boolean().default(false),
    shareDataConsent: z.boolean().default(false),
  }),
});

export const checkoutSchema = z.object({ method: z.enum(PAYMENT_METHODS).optional() });

// ─── Discount codes ─────────────────────────────────────────────────────────

export async function findDiscountCode(code: string | null | undefined) {
  if (!code) return null;
  const record = await db.discountCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!record || !record.active) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;
  if (record.maxRedemptions !== null && record.redemptions >= record.maxRedemptions) return null;
  return record;
}

/** For the receipt's "Apply" button. */
export async function checkDiscountCode(code: string) {
  const record = await findDiscountCode(code);
  return record ? { code: record.code, percentOff: record.percentOff } : null;
}

// ─── Pricing a basket ───────────────────────────────────────────────────────

const serviceInclude = { addons: { where: { active: true } } } as const;

type PricedLine = LinePrice & {
  position: number;
  service: any;
  propertyId: string | null;
  property: z.output<typeof propertySchema> | null;
  answers: Record<string, unknown>;
  missing: Array<{ key: string; label: string }>;
  availabilityId: string | null;
  fastTrack: boolean;
  turnaroundDays: number | null;
  discountSource: "NONE" | "CODE" | "PARTNER";
  estimatedDueAt: string | null;
};

async function resolveServices(refs: string[]) {
  const unique = [...new Set(refs)];
  const services = await db.service.findMany({
    where: { OR: [{ id: { in: unique } }, { code: { in: unique.map((ref) => ref.toUpperCase()) } }, { slug: { in: unique } }] },
    include: serviceInclude,
  });
  const find = (ref: string) => services.find((service: any) => service.id === ref || service.code === ref.toUpperCase() || service.slug === ref);
  for (const ref of unique) {
    const service = find(ref);
    if (!service || !service.active) throw new AppError("VALIDATION_FAILED", "One of the services isn't available.", { serviceId: `Unknown service "${ref}".` });
  }
  return find;
}

/**
 * Price a basket for a customer. Shared by the quote endpoint (no saving) and createOrder.
 * Throws on invalid input; reports (doesn't throw) missing intake answers.
 */
async function priceBasket(context: CustomerContext, raw: z.input<typeof quoteSchema>, options: { ownerId: string | null; requireProperty: boolean }) {
  const input = quoteSchema.parse(raw);
  const [settings, holidays] = await Promise.all([getSettings(), getBankHolidays()]);
  if (input.lines.length > settings.booking.maxPropertiesPerOrder * 3) throw badRequest("That's too many items for one order. Split it into smaller orders.");

  const code = await findDiscountCode(input.discountCode);
  if (input.discountCode && !code) throw new AppError("VALIDATION_FAILED", "That discount code isn't valid.", { discountCode: "Invalid or expired code." });
  const codeBps = code ? percentToBps(code.percentOff) : 0;

  // Expand bundle orders: each input line is a property that gets every bundle service.
  type Expanded = { line: z.output<typeof lineSchema>; serviceRef: string; listOverride?: number; bundleDiscountable?: boolean };
  let expanded: Expanded[];
  let bundle: any = null;
  if (input.bundleId) {
    bundle = await db.bundle.findFirst({
      where: { OR: [{ id: input.bundleId }, { code: input.bundleId.toUpperCase() }, { slug: input.bundleId }], active: true },
      include: { items: { include: { service: true }, orderBy: { position: "asc" } } },
    });
    if (!bundle) throw notFound("Bundle");
    const shares = allocateBundle(bundle.pricePence, bundle.items.map((item: any) => item.service.listPricePence as number));
    expanded = input.lines.flatMap((line) =>
      // Bundles are a fixed price per property: no quantities or add-ons. The visit slot goes to the services that need one.
      bundle.items.map((item: any, index: number) => ({
        line: { ...line, quantity: 1, addons: [], availabilityId: item.service.siteVisit === "NONE" ? undefined : line.availabilityId },
        serviceRef: item.service.id as string,
        listOverride: shares[index]!,
        bundleDiscountable: bundle.discountable as boolean,
      })),
    );
  } else {
    expanded = input.lines.map((line) => {
      if (!line.serviceId) throw new AppError("VALIDATION_FAILED", "Choose a service for every item.", { serviceId: "Required." });
      return { line, serviceRef: line.serviceId };
    });
  }

  const findService = await resolveServices(expanded.map((item) => item.serviceRef));
  const serviceCodes = [...new Set(expanded.map((item) => findService(item.serviceRef)!.code as string))];
  const facts = intakeFacts({ tier: context.tier, serviceCodes, customerType: context.customerType });

  // Common questions: ORDER scope once, LINE scope per line.
  const common = await commonQuestions();
  const orderCheck = checkAnswers(common.filter((question) => question.scope === "ORDER"), input.answers, facts);
  const lineCommon = common.filter((question) => question.scope === "LINE");
  const perService = await serviceQuestions(expanded.map((item) => findService(item.serviceRef)!.id as string));

  // Properties must belong to the customer.
  const propertyIds = [...new Set(expanded.map((item) => item.line.propertyId).filter((id): id is string => Boolean(id)))];
  const ownedProperties = propertyIds.length
    ? await db.property.findMany({ where: { id: { in: propertyIds }, ...(options.ownerId ? { ownerId: options.ownerId } : { id: "__none__" }) }, select: { id: true, tenure: true, postcode: true } })
    : [];
  if (ownedProperties.length !== propertyIds.length) throw new AppError("VALIDATION_FAILED", "Choose one of your saved properties.", { propertyId: "Unknown property." });
  const distinctProperties = new Set(expanded.map((item) => item.line.propertyId ?? JSON.stringify(item.line.property ?? null)));
  if (distinctProperties.size > settings.booking.maxPropertiesPerOrder) throw badRequest(`One order can cover up to ${settings.booking.maxPropertiesPerOrder} properties.`);

  const now = new Date();
  const lines: PricedLine[] = expanded.map((item, position) => {
    const service = findService(item.serviceRef)!;
    const line = item.line;
    if (options.requireProperty && service.requiresProperty && !line.propertyId && !line.property) {
      throw new AppError("VALIDATION_FAILED", `${service.title} needs a property address.`, { [`lines.${position}.propertyId`]: "Choose or add a property." });
    }
    const quantity = service.priceUnit === "PROPERTY" || service.priceUnit === "PACKAGE" ? 1 : line.quantity;

    const addons: AddonInput[] = line.addons.map((selection) => {
      const addon = service.addons.find((candidate: any) => candidate.key === selection.key);
      if (!addon || (addon.audience !== "ALL" && addon.audience !== context.tier)) {
        throw new AppError("VALIDATION_FAILED", `"${selection.key}" isn't available for ${service.title}.`, { [`lines.${position}.addons`]: "Unknown add-on." });
      }
      if (addon.fastTrack && service.fastTrackDays === null) throw badRequest(`${service.title} has no faster turnaround.`);
      return { key: addon.key, name: addon.name, kind: addon.kind, amount: addon.amount, freeAllowance: addon.freeAllowance, quantity: selection.quantity ?? 1 };
    });
    const addonRows = line.addons.map((selection) => service.addons.find((candidate: any) => candidate.key === selection.key)!);

    const discountable = item.bundleDiscountable ?? (service.discountable as boolean);
    const discount = chooseDiscount({ discountable, partnerBps: discountFor(context, item.listOverride !== undefined ? null : service.id, settings), codeBps });
    const price = priceLine({ unitPricePence: item.listOverride ?? service.listPricePence, quantity, listPenceOverride: item.listOverride, discountBps: discount.bps, addons, vatBps: settings.vat.rateBps });

    const fastTrack = service.fastTrackDays !== null && (context.tier === "PARTNER" || addonRows.some((addon: any) => addon.fastTrack));
    const turnaroundDays = (fastTrack ? service.fastTrackDays : service.standardDays) as number | null;

    const tenure = ownedProperties.find((property: any) => property.id === line.propertyId)?.tenure ?? line.property?.tenure ?? null;
    const lineFacts = { ...facts, $tenure: tenure, ...orderCheck.answers };
    const lineCheck = checkAnswers([...lineCommon, ...(perService.get(service.id) ?? [])], line.answers, lineFacts);

    // Rough promise for the quote: from today, or from the picked visit slot.
    let estimatedDueAt: string | null = null;
    if (turnaroundDays !== null && service.siteVisit !== "REQUIRED") {
      estimatedDueAt = dueDate({ start: now, days: turnaroundDays, holidays, sameDayCutoff: settings.booking.sameDayCutoff, dueTime: settings.booking.dueTime, timeZone: settings.booking.timeZone }).toISOString();
    }

    return {
      ...price,
      position,
      service,
      propertyId: line.propertyId ?? null,
      property: line.property ?? null,
      answers: lineCheck.answers,
      missing: lineCheck.missing,
      availabilityId: line.availabilityId ?? null,
      fastTrack,
      turnaroundDays,
      discountSource: discount.bps > 0 ? discount.source : "NONE",
      estimatedDueAt,
    };
  });

  // Visit slots: estimate the due date from the slot, and check it's still free.
  const slotIds = [...new Set(lines.map((line) => line.availabilityId).filter((id): id is string => Boolean(id)))];
  if (slotIds.length) {
    const slots = await db.availability.findMany({ where: { id: { in: slotIds } } });
    for (const line of lines.filter((candidate) => candidate.availabilityId)) {
      const slot = slots.find((candidate: any) => candidate.id === line.availabilityId);
      if (!slot || slot.bookedCount >= slot.capacity) throw new AppError("CONFLICT", "That visit slot has just been taken. Please pick another.", { availabilityId: line.availabilityId });
      if (line.service.siteVisit === "NONE") throw badRequest(`${line.service.title} doesn't need a site visit.`);
      const postcode = ownedProperties.find((property: any) => property.id === line.propertyId)?.postcode ?? line.property?.postcode;
      if (postcode && slot.regionPrefix !== postcodeArea(postcode)) throw new AppError("VALIDATION_FAILED", "That visit slot isn't in this property's area.", { availabilityId: "Pick a slot for this postcode." });
      if (line.turnaroundDays !== null) {
        const start = zonedTime(ymdOf(slot.date), (settings.booking.windows[slot.window as "AM" | "PM"] ?? "08:00").slice(0, 5), settings.booking.timeZone);
        line.estimatedDueAt = dueDate({ start, days: line.turnaroundDays, holidays, sameDayCutoff: settings.booking.sameDayCutoff, dueTime: settings.booking.dueTime, timeZone: settings.booking.timeZone }).toISOString();
      }
    }
  }

  const totals = sumLines(lines);
  const source = lines.some((line) => line.discountSource === "PARTNER") ? "PARTNER" : lines.some((line) => line.discountSource === "CODE") ? "CODE" : "NONE";
  return {
    input,
    settings,
    bundle,
    code: source === "CODE" ? code : null,
    orderAnswers: orderCheck.answers,
    missing: [...orderCheck.missing.map((item) => ({ ...item, line: null as number | null })), ...lines.flatMap((line) => line.missing.map((item) => ({ ...item, line: line.position as number | null })))],
    lines,
    totals,
    discountSource: source as "NONE" | "CODE" | "PARTNER",
  };
}

function lineView(line: PricedLine) {
  return {
    position: line.position,
    service: { id: line.service.id as string, code: line.service.code as string, title: line.service.title as string, slug: line.service.slug as string, priceUnit: line.service.priceUnit as string },
    propertyId: line.propertyId,
    quantity: line.quantity,
    unitPricePence: line.unitPricePence,
    listPence: line.listPence,
    discountBps: line.discountBps,
    discountPence: line.discountPence,
    discountSource: line.discountSource,
    addons: line.addons.map((addon) => ({ key: addon.key, name: addon.name, quantity: addon.quantity, totalPence: addon.totalPence })),
    addonsPence: line.addonsPence,
    netPence: line.netPence,
    vatPence: line.vatPence,
    totalPence: line.totalPence,
    fastTrack: line.fastTrack,
    turnaroundDays: line.turnaroundDays,
    estimatedDueAt: line.estimatedDueAt,
  };
}

/** POST /api/orders/quote — price a basket without saving (works signed out at Basic prices). */
export async function quote(user: Pick<AuthUser, "id"> | null, raw: z.input<typeof quoteSchema>) {
  const context = user ? await getCustomerContext(user.id) : ANONYMOUS;
  // Quotes may be priced before an address is chosen.
  const basket = await priceBasket(context, raw, { ownerId: user?.id ?? null, requireProperty: false });
  return {
    tier: context.tier,
    paymentMethods: paymentMethodsFor(context),
    bundle: basket.bundle ? { id: basket.bundle.id as string, code: basket.bundle.code as string, name: basket.bundle.name as string, pricePence: basket.bundle.pricePence as number } : null,
    discountCode: basket.code?.code ?? null,
    discountSource: basket.discountSource,
    vatRateBps: basket.settings.vat.rateBps,
    lines: basket.lines.map(lineView),
    totals: basket.totals,
    missing: basket.missing,
  };
}

// ─── Orders ─────────────────────────────────────────────────────────────────

const orderInclude = {
  lines: { include: { addons: true, property: true, project: { select: { reference: true, status: true } }, service: { select: { slug: true, imageUrl: true } } }, orderBy: { position: "asc" as const } },
  discountCode: { select: { code: true } },
  bundle: { select: { code: true, name: true } },
} as const;

export function toOrderDto(order: any) {
  const lines = (order.lines ?? []) as any[];
  const first = lines[0];
  return {
    id: order.id as string,
    reference: order.reference as string,
    status: order.status as string,
    customerTier: order.customerTier as CustomerTier,
    paymentMethod: (order.paymentMethod as PaymentMethod | null) ?? null,
    bundle: order.bundle ? { code: order.bundle.code as string, name: order.bundle.name as string } : null,
    /** First line's service, for single-service screens (receipt, confirmation). */
    service: first ? { id: first.serviceId as string, slug: (first.service?.slug as string) ?? "", title: first.serviceTitle as string, imageUrl: (first.service?.imageUrl as string) ?? "" } : null,
    lines: lines.map((line) => ({
      id: line.id as string,
      serviceId: line.serviceId as string,
      serviceCode: line.serviceCode as string,
      serviceTitle: line.serviceTitle as string,
      priceUnit: line.priceUnit as string,
      quantity: line.quantity as number,
      unitPricePence: line.unitPricePence as number,
      listPence: line.listPence as number,
      discountBps: line.discountBps as number,
      discountPence: line.discountPence as number,
      addons: (line.addons ?? []).map((addon: any) => ({ key: addon.key as string, name: addon.name as string, quantity: addon.quantity as number, totalPence: addon.totalPence as number })),
      addonsPence: line.addonsPence as number,
      netPence: line.netPence as number,
      vatPence: line.vatPence as number,
      totalPence: line.totalPence as number,
      fastTrack: line.fastTrack as boolean,
      turnaroundDays: (line.turnaroundDays as number | null) ?? null,
      property: line.property ? { id: line.property.id as string, line1: line.property.line1 as string, postcode: line.property.postcode as string } : null,
      projectReference: (line.project?.reference as string | undefined) ?? null,
      projectStatus: (line.project?.status as string | undefined) ?? null,
    })),
    discountCode: (order.discountCode?.code as string | undefined) ?? null,
    breakdown: {
      listPence: order.listPence as number,
      discountPence: order.discountPence as number,
      discountSource: order.discountSource as string,
      addonsPence: order.addonsPence as number,
      netPence: order.netPence as number,
      vatPence: order.vatPence as number,
      totalPence: order.totalPence as number,
      creditAppliedPence: order.creditAppliedPence as number,
    },
    projectReferences: lines.map((line) => line.project?.reference as string | undefined).filter(Boolean) as string[],
    /** First project, for the single-project confirmation screen. */
    projectReference: (lines.find((line) => line.project)?.project?.reference as string | undefined) ?? null,
    confirmedAt: order.confirmedAt ? (order.confirmedAt as Date).toISOString() : null,
    paidAt: order.paidAt ? (order.paidAt as Date).toISOString() : null,
    createdAt: (order.createdAt as Date).toISOString(),
  };
}
export type OrderDto = ReturnType<typeof toOrderDto>;

/** POST /api/orders — save a DRAFT order. Nothing is charged until checkout. */
export async function createOrder(user: AuthUser, raw: z.input<typeof createOrderSchema>, meta: { ip?: string | null } = {}) {
  const data = createOrderSchema.parse(raw);
  await assertCanBook(user.id);
  const context = await getCustomerContext(user.id);
  const basket = await priceBasket(context, data, { ownerId: user.id, requireProperty: true });

  const order = await db.$transaction(async (tx) => {
    // Save new properties first so lines can point at them.
    const created = new Map<string, string>();
    for (const line of basket.lines) {
      if (line.propertyId || !line.property) continue;
      const key = JSON.stringify(line.property);
      if (!created.has(key)) {
        const count = await tx.property.count({ where: { ownerId: user.id } });
        const property = await tx.property.create({ data: { ...line.property, isPrimary: count === 0, ownerId: user.id } });
        created.set(key, property.id);
      }
      line.propertyId = created.get(key)!;
    }

    return tx.order.create({
      data: {
        reference: await nextOrderReference(tx),
        userId: user.id,
        status: "DRAFT",
        customerTier: context.tier,
        bundleId: basket.bundle?.id ?? null,
        answers: basket.orderAnswers as never,
        termsVersion: basket.settings.booking.termsVersion,
        termsAcceptedAt: new Date(),
        gdprConsent: data.consent.gdprConsent,
        shareDataConsent: data.consent.shareDataConsent,
        consentIp: meta.ip ?? null,
        listPence: basket.totals.listPence,
        discountPence: basket.totals.discountPence,
        discountSource: basket.discountSource,
        addonsPence: basket.totals.addonsPence,
        netPence: basket.totals.netPence,
        vatPence: basket.totals.vatPence,
        totalPence: basket.totals.totalPence,
        discountCodeId: basket.code?.id ?? null,
        lines: {
          create: basket.lines.map((line) => ({
            serviceId: line.service.id,
            propertyId: line.propertyId,
            position: line.position,
            serviceCode: line.service.code,
            serviceTitle: line.service.title,
            priceUnit: line.service.priceUnit,
            unitPricePence: line.unitPricePence,
            quantity: line.quantity,
            listPence: line.listPence,
            discountBps: line.discountBps,
            discountPence: line.discountPence,
            addonsPence: line.addonsPence,
            netPence: line.netPence,
            vatPence: line.vatPence,
            totalPence: line.totalPence,
            fastTrack: line.fastTrack,
            turnaroundDays: line.turnaroundDays,
            answers: line.answers as never,
            availabilityId: line.availabilityId,
            addons: {
              create: line.addons.map((addon) => ({
                addonId: line.service.addons.find((candidate: any) => candidate.key === addon.key)!.id,
                key: addon.key,
                name: addon.name,
                kind: addon.kind,
                amount: addon.amount,
                quantity: addon.quantity,
                totalPence: addon.totalPence,
              })),
            },
          })),
        },
      },
      include: orderInclude,
    });
  });
  return { order: toOrderDto(order), missing: basket.missing, paymentMethods: paymentMethodsFor(context) };
}

async function ownOrder(user: Pick<AuthUser, "id">, idOrRef: string) {
  const order = await db.order.findFirst({ where: { userId: user.id, OR: [{ id: idOrRef }, { reference: idOrRef }] }, include: orderInclude });
  if (!order) throw notFound("Order");
  return order;
}

export async function listOrders(user: Pick<AuthUser, "id">) {
  const orders = await db.order.findMany({ where: { userId: user.id }, include: orderInclude, orderBy: { createdAt: "desc" }, take: 100 });
  return orders.map(toOrderDto);
}

export async function getOrder(user: Pick<AuthUser, "id">, idOrRef: string) {
  return toOrderDto(await ownOrder(user, idOrRef));
}

/** Cancel an unpaid order. Credit held for a part-card payment goes back to the account. */
export async function cancelOrder(user: Pick<AuthUser, "id">, idOrRef: string) {
  const order = await ownOrder(user, idOrRef);
  if (order.status !== "DRAFT" && order.status !== "PENDING_PAYMENT") throw conflict("Only unpaid orders can be cancelled here. To cancel a booked service, cancel its project.");
  if (order.stripeSessionId && integrations.stripe()) await requireStripe().checkout.sessions.expire(order.stripeSessionId).catch(() => undefined);
  const cancelled = await db.$transaction(async (tx) => {
    if (order.creditAppliedPence > 0) {
      await addCreditEntry(tx, { userId: order.userId, type: "REFUND", amountPence: order.creditAppliedPence, orderId: order.id, note: `Order ${order.reference} cancelled before payment` });
    }
    return tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: new Date(), creditAppliedPence: 0 }, include: orderInclude });
  });
  return toOrderDto(cancelled);
}

// ─── Checkout ───────────────────────────────────────────────────────────────

/**
 * POST /api/orders/:id/checkout { method }. Returns where to send the browser:
 * Stripe Checkout for card payments, or the confirmation page when the order is confirmed
 * straight away (credit, weekly invoice, or dev mode without Stripe).
 */
export async function checkout(user: AuthUser, idOrRef: string, raw: z.input<typeof checkoutSchema> = {}) {
  const { method: requested } = checkoutSchema.parse(raw);
  const order = await ownOrder(user, idOrRef);
  const confirmation = appUrl(`/checkout/confirmation?order=${order.reference}`);
  if (order.status === "CONFIRMED") return { url: confirmation, paid: true };
  if (order.status !== "DRAFT" && order.status !== "PENDING_PAYMENT") throw conflict("This order can no longer be paid.");
  if (order.status === "PENDING_PAYMENT" && order.creditAppliedPence > 0) throw conflict("This order is waiting for the card payment to finish.");

  const context = await getCustomerContext(user.id);
  if (context.tier !== order.customerTier) throw conflict("Your account type changed since this order was priced. Please start the order again.");
  const methods = paymentMethodsFor(context);
  const method = requested ?? methods[0]!;
  if (!methods.includes(method)) throw badRequest(`Pay by ${methods.map((item) => item.toLowerCase().replace(/_/g, " ")).join(" or ")}.`);

  await assertCanBook(user.id, { weekly: method === "WEEKLY_INVOICE", additionalPence: order.totalPence });

  if (method === "WEEKLY_INVOICE") {
    await confirmOrder(order.id, { method: "WEEKLY_INVOICE" });
    return { url: confirmation, paid: true };
  }
  if (method === "CREDIT") {
    await confirmOrder(order.id, { method: "CREDIT" });
    return { url: confirmation, paid: true };
  }

  let cardPence = order.totalPence;
  if (method === "CREDIT_AND_CARD") {
    const balance = await creditBalance(user.id);
    const creditPart = Math.min(balance, order.totalPence);
    if (creditPart >= order.totalPence) {
      await confirmOrder(order.id, { method: "CREDIT" });
      return { url: confirmation, paid: true };
    }
    if (creditPart > 0) {
      // Hold the credit now so it can't be spent twice while the card payment runs.
      await db.$transaction(async (tx) => {
        await addCreditEntry(tx, { userId: user.id, type: "DEDUCTION", amountPence: -creditPart, orderId: order.id, note: `Part payment for ${order.reference}` });
        await tx.order.update({ where: { id: order.id }, data: { creditAppliedPence: creditPart, status: "PENDING_PAYMENT" } });
      });
      cardPence -= creditPart;
    }
  }

  if (!integrations.stripe()) {
    if (isProduction()) throw notConfigured("Payments are not configured.");
    await confirmOrder(order.id, { method: method === "CREDIT_AND_CARD" && cardPence < order.totalPence ? "CREDIT_AND_CARD" : "CARD", paymentIntentId: null });
    return { url: confirmation, paid: true };
  }

  const summary = order.lines.length === 1 ? order.lines[0]!.serviceTitle : `${order.lines.length} services`;
  const session = await requireStripe().checkout.sessions.create({
    mode: "payment",
    customer: await ensureStripeCustomer(user),
    client_reference_id: order.id,
    metadata: { kind: "order", orderId: order.id, method },
    payment_intent_data: { metadata: { kind: "order", orderId: order.id } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: cardPence,
          product_data: {
            name: `${summary} — ${order.reference}`,
            description: `Includes VAT ${formatPence(order.vatPence)}${order.creditAppliedPence ? `. ${formatPence(order.creditAppliedPence)} paid from account credit.` : ""}`,
          },
        },
      },
    ],
    success_url: confirmation,
    cancel_url: appUrl(`/checkout/${order.lines[0]?.service?.slug ?? ""}/payment?order=${order.reference}&cancelled=1`),
  });
  await db.order.update({ where: { id: order.id }, data: { status: "PENDING_PAYMENT", stripeSessionId: session.id, paymentMethod: method } });
  return { url: session.url!, paid: false };
}

/**
 * Confirm an order and create its projects. Idempotent: Stripe can deliver a webhook more
 * than once, and the dev shortcut can race the redirect.
 *  - CARD / CREDIT / CREDIT_AND_CARD: paid now → VAT receipt (ORDER invoice, PAID)
 *  - WEEKLY_INVOICE: billed on the partner's next weekly invoice
 */
export async function confirmOrder(orderId: string, payment: { method: PaymentMethod; paymentIntentId?: string | null }) {
  const settings = await getSettings();
  const result = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { lines: { orderBy: { position: "asc" } }, user: true } });
      if (!order) throw notFound("Order");
      if (order.status === "CONFIRMED") return null;
      if (order.status === "CANCELLED" || order.status === "REFUNDED") throw conflict("Order is no longer payable.");

      const now = new Date();
      const paidNow = payment.method !== "WEEKLY_INVOICE";
      let creditEntryId: string | null = null;
      if (payment.method === "CREDIT") {
        const entry = await addCreditEntry(tx, { userId: order.userId, type: "DEDUCTION", amountPence: -order.totalPence, orderId: order.id, note: `Booking ${order.reference}` });
        creditEntryId = entry.id;
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CONFIRMED",
          paymentMethod: payment.method,
          confirmedAt: now,
          paidAt: paidNow ? now : null,
          stripePaymentIntentId: payment.paymentIntentId ?? order.stripePaymentIntentId,
          ...(payment.method === "CREDIT" ? { creditAppliedPence: order.totalPence } : {}),
        },
      });
      if (order.discountCodeId) await tx.discountCode.update({ where: { id: order.discountCodeId }, data: { redemptions: { increment: 1 } } });

      let receiptNumber: string | null = null;
      if (paidNow) {
        const receipt = await issueInvoice(tx, {
          userId: order.userId,
          kind: "ORDER",
          status: "PAID",
          description: `Booking ${order.reference}`,
          lines: order.lines.map((line: any) => ({
            description: `${line.serviceTitle}${line.quantity > 1 ? ` × ${line.quantity}` : ""}`,
            orderId: order.id,
            listPence: line.listPence + line.addonsPence,
            discountPence: line.discountPence,
            netPence: line.netPence,
            vatPence: line.vatPence,
            totalPence: line.totalPence,
          })),
          paidAt: now,
          paidVia: payment.method,
          stripePaymentIntentId: payment.paymentIntentId ?? null,
          settings,
        });
        receiptNumber = receipt.number;
        await tx.creditEntry.updateMany({ where: { orderId: order.id, type: "DEDUCTION", invoiceId: null }, data: { invoiceId: receipt.id } });
        if (creditEntryId) await tx.creditEntry.update({ where: { id: creditEntryId }, data: { invoiceId: receipt.id } });
      }

      const projects = await createProjectsForOrder(tx, order.id);
      return { order, projects, receiptNumber };
    },
    { timeout: 60_000 },
  );

  if (result) {
    const { order, projects } = result;
    const first = projects[0];
    await sendTemplate("order_confirmation", order.user.email, {
      user_name: displayName(order.user),
      service_name: order.lines.length === 1 ? order.lines[0]!.serviceTitle : `${order.lines.length} services`,
      order_ref: order.reference,
      project_ref: projects.map((project) => project.reference).join(", "),
      total: formatPence(order.totalPence),
      payment: payment.method === "WEEKLY_INVOICE" ? "It will appear on this week's invoice." : `Paid${result.receiptNumber ? ` (receipt ${result.receiptNumber})` : ""}.`,
      link: appUrl(first ? `/dashboard/projects/${first.reference}` : "/dashboard"),
    });
  }
  return result?.projects ?? [];
}

/** Webhook: Stripe refunded a payment. */
export async function markRefunded(paymentIntentId: string, fully: boolean) {
  if (fully) await db.order.updateMany({ where: { stripePaymentIntentId: paymentIntentId }, data: { status: "REFUNDED" } });
}

/** Confirmation page: the order with its project references. */
export async function getConfirmation(user: Pick<AuthUser, "id">, reference: string) {
  const order = await db.order.findFirst({ where: { userId: user.id, reference }, include: orderInclude });
  return order ? toOrderDto(order) : null;
}

/** Shortcut for UI code: price one service for one property. */
export async function quoteSingle(user: Pick<AuthUser, "id"> | null, input: { serviceId: string; quantity?: number; addons?: Array<{ key: string; quantity?: number }>; discountCode?: string | null; propertyId?: string | null }) {
  return quote(user, {
    lines: [{ serviceId: input.serviceId, quantity: input.quantity ?? 1, addons: input.addons ?? [], propertyId: input.propertyId ?? undefined, property: undefined, answers: {} }],
    discountCode: input.discountCode ?? undefined,
    answers: {},
  });
}

