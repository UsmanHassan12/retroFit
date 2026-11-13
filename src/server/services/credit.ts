import "server-only";

import { z } from "zod";

import type { AuthUser } from "../auth/session";
import { db, type Tx } from "../db";
import { appUrl, integrations, requiresIntegrations } from "../env";
import { AppError, badRequest, conflict, notConfigured, notFound } from "../errors";
import { sendTemplate } from "../integrations/email";
import { requireStripe } from "../integrations/stripe";
import { formatPence } from "../rules/pricing";
import { audit } from "./audit";
import { ensureStripeCustomer } from "./customers";
import { issueInvoice } from "./invoices";
import { getSettings } from "./settings";

/**
 * Prepaid account credit for Premium Partners on "pay in advance" (Mode A).
 * The ledger is append-only; each row stores the running balance. Writes for one user are
 * serialised with a Postgres advisory lock so two bookings can't spend the same credit.
 */

type CreditType = "TOPUP" | "DEDUCTION" | "REFUND" | "ADJUSTMENT";

async function lockLedger(tx: Tx, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`credit:${userId}`}))`;
}

export async function creditBalance(userId: string, client: Tx | typeof db = db) {
  const result = await client.creditEntry.aggregate({ where: { userId }, _sum: { amountPence: true } });
  return (result._sum.amountPence as number | null) ?? 0;
}

/** Append a ledger row inside a transaction. Deductions never take the balance below zero. */
export async function addCreditEntry(
  tx: Tx,
  entry: { userId: string; type: CreditType; amountPence: number; orderId?: string | null; invoiceId?: string | null; note?: string | null; stripePaymentIntentId?: string | null; createdById?: string | null },
) {
  await lockLedger(tx, entry.userId);
  const balance = await creditBalance(entry.userId, tx);
  const next = balance + entry.amountPence;
  if (entry.amountPence < 0 && next < 0) {
    throw new AppError("PAYMENT_REQUIRED", "Not enough account credit. Top up or pay the difference by card.", {
      balancePence: balance,
      shortfallPence: -next,
    });
  }
  return tx.creditEntry.create({
    data: {
      userId: entry.userId,
      type: entry.type,
      amountPence: entry.amountPence,
      balanceAfterPence: next,
      orderId: entry.orderId ?? null,
      invoiceId: entry.invoiceId ?? null,
      note: entry.note ?? null,
      stripePaymentIntentId: entry.stripePaymentIntentId ?? null,
      createdById: entry.createdById ?? null,
    },
  });
}

const toEntry = (entry: any) => ({
  id: entry.id as string,
  type: entry.type as CreditType,
  amountPence: entry.amountPence as number,
  balanceAfterPence: entry.balanceAfterPence as number,
  orderId: (entry.orderId as string | null) ?? null,
  invoiceId: (entry.invoiceId as string | null) ?? null,
  note: (entry.note as string | null) ?? null,
  at: (entry.createdAt as Date).toISOString(),
});

export async function creditStatement(userId: string, take = 50) {
  const [balancePence, entries] = await Promise.all([
    creditBalance(userId),
    db.creditEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take }),
  ]);
  return { balancePence, entries: entries.map(toEntry) };
}

// ─── Top-ups ────────────────────────────────────────────────────────────────

export const topupSchema = z.object({ amountPence: z.number().int().positive().max(10_000_000) });

/**
 * Record a top-up (Stripe webhook, dev shortcut, or admin recording a bank transfer).
 * Idempotent on the payment intent. Produces a receipt (CREDIT_TOPUP invoice). The receipt
 * shows no VAT: VAT is charged on each booking's receipt when credit is spent.
 */
export async function recordTopup(input: { userId: string; amountPence: number; via: "CARD" | "BANK_TRANSFER"; paymentIntentId?: string | null; actorId?: string | null; note?: string | null }) {
  const settings = await getSettings();
  const result = await db.$transaction(async (tx) => {
    if (input.paymentIntentId) {
      const existing = await tx.creditEntry.findUnique({ where: { stripePaymentIntentId: input.paymentIntentId } });
      if (existing) return null;
    }
    const receipt = await issueInvoice(tx, {
      userId: input.userId,
      kind: "CREDIT_TOPUP",
      status: "PAID",
      description: `Account credit top-up (${input.via === "CARD" ? "card" : "bank transfer"})`,
      lines: [{ description: "Prepaid account credit", netPence: input.amountPence, vatPence: 0, totalPence: input.amountPence }],
      paidVia: input.via,
      stripePaymentIntentId: input.paymentIntentId ?? null,
      settings,
    });
    const entry = await addCreditEntry(tx, {
      userId: input.userId,
      type: "TOPUP",
      amountPence: input.amountPence,
      invoiceId: receipt.id,
      note: input.note ?? null,
      stripePaymentIntentId: input.paymentIntentId ?? null,
      createdById: input.actorId ?? null,
    });
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { email: true, firstName: true } });
    return { receipt, entry, user };
  });
  if (result?.user) {
    await sendTemplate("credit_receipt", result.user.email, {
      user_name: result.user.firstName,
      amount: formatPence(input.amountPence),
      balance: formatPence(result.entry.balanceAfterPence),
      receipt_number: result.receipt.number,
      link: appUrl("/dashboard/billing"),
    });
  }
  if (input.actorId) await audit(input.actorId, "credit.topup", "User", input.userId, { amountPence: input.amountPence, via: input.via });
  return result?.entry ? toEntry(result.entry) : null;
}

/** Partner: start a card top-up. Dev without Stripe credits the account at once. */
export async function startTopup(user: AuthUser, input: z.input<typeof topupSchema>) {
  const { amountPence } = topupSchema.parse(input);
  const settings = await getSettings();
  if (user.tier !== "PARTNER") throw new AppError("FORBIDDEN", "Account credit is for Premium Partners.");
  if (amountPence < settings.partner.minTopupPence) throw badRequest(`The minimum top-up is ${formatPence(settings.partner.minTopupPence)}.`);

  if (!integrations.stripe()) {
    if (requiresIntegrations()) throw notConfigured("Payments are not configured.");
    await recordTopup({ userId: user.id, amountPence, via: "CARD", note: "Development top-up (no Stripe)" });
    return { url: appUrl("/dashboard/billing?topup=1"), paid: true };
  }
  const session = await requireStripe().checkout.sessions.create({
    mode: "payment",
    customer: await ensureStripeCustomer(user),
    client_reference_id: user.id,
    metadata: { kind: "topup", userId: user.id, amountPence: String(amountPence) },
    payment_intent_data: { metadata: { kind: "topup", userId: user.id } },
    line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: amountPence, product_data: { name: "Retrofit Portal account credit" } } }],
    success_url: appUrl("/dashboard/billing?topup=1"),
    cancel_url: appUrl("/dashboard/billing"),
  });
  return { url: session.url!, paid: false };
}

export const adjustmentSchema = z.object({
  amountPence: z.number().int().refine((value) => value !== 0, "Enter an amount."),
  type: z.enum(["TOPUP", "ADJUSTMENT", "REFUND"]).default("ADJUSTMENT"),
  note: z.string().trim().min(3, "Say why.").max(300),
});

/** Admin: bank-transfer top-up (type TOPUP, positive) or a manual adjustment / refund. */
export async function adminCreditEntry(actorId: string, userId: string, input: z.input<typeof adjustmentSchema>) {
  const data = adjustmentSchema.parse(input);
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw notFound("User");
  if (data.type === "TOPUP") {
    if (data.amountPence < 0) throw badRequest("A top-up must be positive.");
    return recordTopup({ userId, amountPence: data.amountPence, via: "BANK_TRANSFER", actorId, note: data.note });
  }
  if (data.type === "REFUND" && data.amountPence > 0) throw conflict("A refund paid out to the partner is a negative amount.");
  const entry = await db.$transaction((tx) => addCreditEntry(tx, { userId, type: data.type, amountPence: data.amountPence, note: data.note, createdById: actorId }));
  await audit(actorId, `credit.${data.type.toLowerCase()}`, "User", userId, data);
  return toEntry(entry);
}
