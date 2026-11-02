import "server-only";

import { z } from "zod";

import type { AuthUser } from "../auth/session";
import { displayName } from "../auth/session";
import { db, type Tx } from "../db";
import { appUrl, integrations, isProduction } from "../env";
import { AppError, conflict, notFound } from "../errors";
import { PHASE_LABELS, PROJECT_PHASES } from "../domain";
import { sendTemplate } from "../integrations/email";
import { requireStripe } from "../integrations/stripe";
import { priceOrder } from "./pricing";
import { nextOrderReference, nextProjectReference } from "./references";

// ─── Schemas ────────────────────────────────────────────────────────────────

/** ids or storefront keys are both accepted: `serviceId` may be a slug, `tierId` a key ("premium"). */
export const createOrderSchema = z.object({
  serviceId: z.string().trim().min(1),
  tierId: z.string().trim().min(1),
  addonIds: z.array(z.string().trim().min(1)).max(20).default([]),
  propertyId: z.string().trim().min(1).optional(),
  discountCode: z.string().trim().max(32).optional(),
});

export const updateOrderSchema = z
  .object({
    tierId: z.string().trim().min(1),
    addonIds: z.array(z.string().trim().min(1)).max(20),
    propertyId: z.string().trim().min(1).nullable(),
    discountCode: z.string().trim().max(32).nullable(),
  })
  .partial();

const orderInclude = {
  addons: { include: { addon: { select: { key: true } } } },
  tier: { select: { key: true } },
  service: { select: { slug: true, title: true, imageUrl: true } },
  project: { select: { reference: true } },
  discountCode: { select: { code: true } },
} as const;

export function toOrderDto(order: any) {
  return {
    id: order.id as string,
    reference: order.reference as string,
    status: order.status as string,
    service: { id: order.serviceId as string, slug: order.service?.slug as string, title: order.serviceTitle as string, imageUrl: order.service?.imageUrl as string },
    tier: { id: order.tierId as string, key: order.tier?.key as string, name: order.tierName as string },
    addons: (order.addons ?? []).map((addon: any) => ({
      id: addon.addonId as string,
      key: addon.addon?.key as string,
      name: addon.name as string,
      pricePence: addon.pricePence as number,
    })),
    propertyId: order.propertyId as string | null,
    discountCode: (order.discountCode?.code as string | undefined) ?? null,
    breakdown: {
      basePence: order.basePence as number,
      addonsPence: order.addonsPence as number,
      discountPence: order.discountPence as number,
      discountSource: order.discountSource as string,
      vatPence: order.vatPence as number,
      totalPence: order.totalPence as number,
    },
    projectReference: (order.project?.reference as string | undefined) ?? null,
    paidAt: order.paidAt ? (order.paidAt as Date).toISOString() : null,
    createdAt: (order.createdAt as Date).toISOString(),
  };
}

export type OrderDto = ReturnType<typeof toOrderDto>;

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

// ─── Draft orders ───────────────────────────────────────────────────────────

async function resolveSelection(serviceRef: string, tierRef: string, addonRefs: string[]) {
  const service = await db.service.findFirst({
    where: { OR: [{ id: serviceRef }, { slug: serviceRef }] },
    include: { tiers: true, addons: { where: { active: true } } },
  });
  if (!service || !service.active) throw notFound("Service");
  const tier = service.tiers.find((item: any) => item.id === tierRef || item.key === tierRef);
  if (!tier) throw new AppError("VALIDATION_FAILED", "Choose a valid pricing tier.", { tierId: "Unknown tier." });
  const wanted = new Set(addonRefs);
  const addons = service.addons.filter((addon: any) => wanted.has(addon.id) || wanted.has(addon.key));
  if (addons.length !== wanted.size) {
    throw new AppError("VALIDATION_FAILED", "One of the selected add-ons isn't available.", { addonIds: "Unknown add-on." });
  }
  return { service, tier, addons };
}

async function assertOwnProperty(userId: string, propertyId: string | null | undefined) {
  if (!propertyId) return;
  const property = await db.property.findFirst({ where: { id: propertyId, ownerId: userId }, select: { id: true } });
  if (!property) throw new AppError("VALIDATION_FAILED", "Choose one of your properties.", { propertyId: "Unknown property." });
}

async function resolveCode(code: string | null | undefined) {
  if (!code) return null;
  const record = await findDiscountCode(code);
  if (!record) throw new AppError("VALIDATION_FAILED", "That discount code isn’t valid.", { discountCode: "Invalid or expired code." });
  return record;
}

/** Preview totals without saving (used by the review / payment pages). */
export async function quote(user: Pick<AuthUser, "plan"> | null, input: { serviceId: string; tierId: string; addonIds?: string[]; discountCode?: string | null }) {
  const { service, tier, addons } = await resolveSelection(input.serviceId, input.tierId, input.addonIds ?? []);
  const code = await findDiscountCode(input.discountCode);
  return {
    service: { id: service.id, slug: service.slug, title: service.title },
    tier: { id: tier.id, key: tier.key, name: tier.name },
    addons: addons.map((addon: any) => ({ id: addon.id, key: addon.key, name: addon.name, pricePence: addon.pricePence })),
    discountCode: code?.code ?? null,
    breakdown: priceOrder({ basePence: tier.pricePence, addonPence: addons.map((addon: any) => addon.pricePence), codePercent: code?.percentOff, plan: user?.plan }),
  };
}

export async function createOrder(user: AuthUser, input: z.input<typeof createOrderSchema>) {
  const data = createOrderSchema.parse(input);
  const { service, tier, addons } = await resolveSelection(data.serviceId, data.tierId, data.addonIds);
  await assertOwnProperty(user.id, data.propertyId);
  const code = await resolveCode(data.discountCode);
  const price = priceOrder({ basePence: tier.pricePence, addonPence: addons.map((addon: any) => addon.pricePence), codePercent: code?.percentOff, plan: user.plan });

  const order = await db.$transaction(async (tx) =>
    tx.order.create({
      data: {
        reference: await nextOrderReference(tx),
        userId: user.id,
        serviceId: service.id,
        tierId: tier.id,
        propertyId: data.propertyId ?? null,
        serviceTitle: service.title,
        tierName: tier.name,
        basePence: price.basePence,
        addonsPence: price.addonsPence,
        discountPence: price.discountPence,
        discountSource: price.discountSource,
        vatPence: price.vatPence,
        totalPence: price.totalPence,
        discountCodeId: price.discountSource === "CODE" ? (code?.id ?? null) : null,
        addons: { create: addons.map((addon: any) => ({ addonId: addon.id, name: addon.name, pricePence: addon.pricePence })) },
      },
      include: orderInclude,
    }),
  );
  return toOrderDto(order);
}

async function ownOrder(user: Pick<AuthUser, "id">, idOrRef: string) {
  const order = await db.order.findFirst({ where: { userId: user.id, OR: [{ id: idOrRef }, { reference: idOrRef }] }, include: orderInclude });
  if (!order) throw notFound("Order");
  return order;
}

export async function listOrders(user: Pick<AuthUser, "id">) {
  const orders = await db.order.findMany({ where: { userId: user.id }, include: orderInclude, orderBy: { createdAt: "desc" } });
  return orders.map(toOrderDto);
}

export async function getOrder(user: Pick<AuthUser, "id">, idOrRef: string) {
  return toOrderDto(await ownOrder(user, idOrRef));
}

export async function updateOrder(user: AuthUser, idOrRef: string, input: z.input<typeof updateOrderSchema>) {
  const data = updateOrderSchema.parse(input);
  const order = await ownOrder(user, idOrRef);
  if (order.status !== "DRAFT") throw conflict("Only draft orders can be changed.");

  const { tier, addons } = await resolveSelection(order.serviceId, data.tierId ?? order.tierId, data.addonIds ?? order.addons.map((addon: any) => addon.addonId));
  if (data.propertyId !== undefined) await assertOwnProperty(user.id, data.propertyId);
  const code = data.discountCode === undefined ? (order.discountCodeId ? await db.discountCode.findUnique({ where: { id: order.discountCodeId } }) : null) : await resolveCode(data.discountCode);
  const price = priceOrder({ basePence: tier.pricePence, addonPence: addons.map((addon: any) => addon.pricePence), codePercent: code?.percentOff, plan: user.plan });

  const updated = await db.$transaction(async (tx) => {
    await tx.orderAddon.deleteMany({ where: { orderId: order.id } });
    return tx.order.update({
      where: { id: order.id },
      data: {
        tierId: tier.id,
        tierName: tier.name,
        ...(data.propertyId !== undefined ? { propertyId: data.propertyId } : {}),
        basePence: price.basePence,
        addonsPence: price.addonsPence,
        discountPence: price.discountPence,
        discountSource: price.discountSource,
        vatPence: price.vatPence,
        totalPence: price.totalPence,
        discountCodeId: price.discountSource === "CODE" ? (code?.id ?? null) : null,
        addons: { create: addons.map((addon: any) => ({ addonId: addon.id, name: addon.name, pricePence: addon.pricePence })) },
      },
      include: orderInclude,
    });
  });
  return toOrderDto(updated);
}

export async function cancelOrder(user: Pick<AuthUser, "id">, idOrRef: string) {
  const order = await ownOrder(user, idOrRef);
  if (order.status !== "DRAFT" && order.status !== "PENDING_PAYMENT") throw conflict("Only unpaid orders can be cancelled.");
  if (order.stripeSessionId && integrations.stripe()) {
    await requireStripe().checkout.sessions.expire(order.stripeSessionId).catch(() => undefined);
  }
  const cancelled = await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" }, include: orderInclude });
  return toOrderDto(cancelled);
}

// ─── Payment ────────────────────────────────────────────────────────────────

/**
 * Start payment. With Stripe configured this returns a hosted Checkout URL. Without it
 * (development only) the order is marked paid immediately so the whole flow can be tried.
 */
export async function checkout(user: AuthUser, idOrRef: string) {
  const order = await ownOrder(user, idOrRef);
  if (order.status === "PAID") return { url: appUrl(`/checkout/confirmation?order=${order.reference}`), paid: true };
  if (order.status !== "DRAFT" && order.status !== "PENDING_PAYMENT") throw conflict("This order can no longer be paid.");

  if (!integrations.stripe()) {
    if (isProduction()) throw new AppError("NOT_CONFIGURED", "Payments are not configured.");
    await fulfilOrder(order.id, { paymentIntentId: null });
    return { url: appUrl(`/checkout/confirmation?order=${order.reference}`), paid: true };
  }

  const stripe = requireStripe();
  const customerId = await ensureStripeCustomer(user);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    client_reference_id: order.id,
    metadata: { orderId: order.id, kind: "order" },
    payment_intent_data: { metadata: { orderId: order.id } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: order.totalPence,
          product_data: {
            name: `${order.serviceTitle} — ${order.tierName}`,
            description: `Order ${order.reference}. Includes VAT ${(order.vatPence / 100).toFixed(2)} GBP.`,
          },
        },
      },
    ],
    success_url: appUrl(`/checkout/confirmation?order=${order.reference}`),
    cancel_url: appUrl(
      `/checkout/${order.service.slug}/payment?${new URLSearchParams({
        tier: order.tier.key,
        ...(order.addons.length ? { addons: order.addons.map((addon: any) => addon.addon.key).join(",") } : {}),
        cancelled: "1",
      }).toString()}`,
    ),
  });
  await db.order.update({ where: { id: order.id }, data: { status: "PENDING_PAYMENT", stripeSessionId: session.id } });
  return { url: session.url!, paid: false };
}

export async function ensureStripeCustomer(user: Pick<AuthUser, "id" | "email" | "name">) {
  const stripe = requireStripe();
  const record = await db.user.findUnique({ where: { id: user.id }, select: { stripeCustomerId: true } });
  if (record?.stripeCustomerId) return record.stripeCustomerId as string;
  const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { userId: user.id } });
  await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/** Least-loaded active coordinator, for auto-assignment. */
async function pickCoordinator(tx: Tx) {
  const coordinators = await tx.user.findMany({
    where: { role: "COORDINATOR", status: "ACTIVE" },
    select: { id: true, _count: { select: { coordinatedProjects: { where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } } } },
  });
  coordinators.sort((a: any, b: any) => a._count.coordinatedProjects - b._count.coordinatedProjects);
  return (coordinators[0]?.id as string | undefined) ?? null;
}

/**
 * Mark an order paid and create its project. Idempotent: Stripe may deliver the webhook
 * more than once, and the dev shortcut may race the success redirect.
 */
export async function fulfilOrder(orderId: string, payment: { paymentIntentId: string | null }) {
  const result = await db.$transaction(async (tx) => {
    // Row lock so concurrent deliveries serialise.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { tier: true, user: true, service: true, project: true },
    });
    if (!order) throw notFound("Order");
    if (order.status === "PAID" || order.project) return null;
    if (order.status === "CANCELLED" || order.status === "REFUNDED") throw conflict("Order is no longer payable.");

    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), stripePaymentIntentId: payment.paymentIntentId },
    });
    if (order.discountCodeId) await tx.discountCode.update({ where: { id: order.discountCodeId }, data: { redemptions: { increment: 1 } } });

    const property = order.propertyId
      ? await tx.property.findUnique({ where: { id: order.propertyId } })
      : await tx.property.findFirst({ where: { ownerId: order.userId }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });

    const coordinatorId = await pickCoordinator(tx);
    const due = new Date(Date.now() + (order.tier.deliveryDays + 2) * 86_400_000);
    const project = await tx.project.create({
      data: {
        reference: await nextProjectReference(tx),
        orderId: order.id,
        clientId: order.userId,
        serviceId: order.serviceId,
        propertyId: property?.id ?? null,
        coordinatorId,
        title: order.serviceTitle,
        phase: "ASSESSMENT" as const,
        phaseDescription: "Your coordinator is reviewing your order and will book the assessment visit.",
        status: "ON_TRACK" as const,
        progress: 10,
        scheme: order.service.schemes[0] ?? null,
        dueDate: due,
        milestones: {
          create: PROJECT_PHASES.map((phase, position) => ({
            phase,
            title: PHASE_LABELS[phase],
            position,
            status: phase === "PURCHASED" ? ("DONE" as const) : phase === "ASSESSMENT" ? ("CURRENT" as const) : ("UPCOMING" as const),
            completedAt: phase === "PURCHASED" ? new Date() : null,
          })),
        },
        deliverables: {
          create: order.tier.deliverables.map((title: string) => ({
            title,
            description: "Prepared during your project.",
            kind: "PDF" as const,
            status: "PENDING" as const,
          })),
        },
        tasks: {
          create: [
            { title: "Order created", column: "DONE" as const, position: 0, tags: ["System"], completedAt: new Date() },
            { title: "Upload proof of ownership and current EPC", column: "AWAITING_CLIENT" as const, position: 0, tags: ["Client", "Docs"], visibleToClient: true },
            { title: "Book assessment visit", column: "ASSESSMENT" as const, position: 0, tags: ["Assessor"], assigneeId: coordinatorId },
          ],
        },
        activities: { create: [{ actorId: order.userId, type: "order.paid", message: `Order ${order.reference} paid` }] },
        ...(coordinatorId ? { members: { create: [{ userId: coordinatorId }] } } : {}),
      },
    });
    return { order, project };
  });

  if (result) {
    const { order, project } = result;
    await sendTemplate("order_confirmation", order.user.email, {
      user_name: displayName(order.user),
      service_name: order.serviceTitle,
      tier_name: order.tierName,
      order_ref: order.reference,
      project_ref: project.reference,
      total: `£${(order.totalPence / 100).toFixed(2)}`,
      link: appUrl(`/dashboard/projects/${project.reference}`),
    });
  }
  return result?.project.reference ?? null;
}

/** Called from the webhook when Stripe refunds a payment. */
export async function markRefunded(paymentIntentId: string) {
  await db.order.updateMany({ where: { stripePaymentIntentId: paymentIntentId }, data: { status: "REFUNDED" } });
}

/** Confirmation page: the order, once paid, with its project reference. */
export async function getConfirmation(user: Pick<AuthUser, "id">, reference: string) {
  const order = await db.order.findFirst({ where: { userId: user.id, reference }, include: orderInclude });
  return order ? toOrderDto(order) : null;
}

