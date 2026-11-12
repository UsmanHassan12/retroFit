import "server-only";

import { z } from "zod";

import { db } from "../db";
import { appUrl } from "../env";
import { AppError, notFound } from "../errors";
import { sendEmail, sendTemplate } from "../integrations/email";
import { formatPence } from "../rules/pricing";
import { audit } from "./audit";
import { getSettings } from "./settings";
import { activeHold, pauseProjectsForHold, resumeProjectsAfterHold } from "./workflow";

export { activeHold };

/**
 * Account holds (catalogue doc → Mode B rule 5–6, agreement clause 8):
 *  - on hold: no new bookings, work on open projects pauses (setting billing.holdPausesWork),
 *    deliverables can't be downloaded; partner and admins are notified;
 *  - paying in full lifts an automatic hold; an admin can lift any hold with a reason;
 *  - turnaround times restart once the hold is lifted.
 */

/** Unbilled weekly-invoice work plus unpaid invoices, in pence. */
export async function exposure(userId: string) {
  const [unbilled, unpaid] = await Promise.all([
    db.orderLine.aggregate({
      where: {
        order: { userId, status: "CONFIRMED", paymentMethod: "WEEKLY_INVOICE" },
        invoiceLine: { is: null },
        project: { is: { status: { not: "CANCELLED" } } },
      },
      _sum: { totalPence: true },
    }),
    db.invoice.aggregate({ where: { userId, status: { in: ["ISSUED", "OVERDUE"] } }, _sum: { totalPence: true } }),
  ]);
  const unbilledPence = (unbilled._sum.totalPence as number | null) ?? 0;
  const unpaidPence = (unpaid._sum.totalPence as number | null) ?? 0;
  return { unbilledPence, unpaidPence, totalPence: unbilledPence + unpaidPence };
}

/**
 * Throws when the customer may not book: account on hold, or (weekly partners) the credit
 * limit would be exceeded by `additionalPence`.
 */
export async function assertCanBook(userId: string, options: { additionalPence?: number; weekly?: boolean } = {}) {
  const hold = await activeHold(userId);
  if (hold) throw new AppError("LOCKED", "Your account is on hold, so new bookings are paused. Please pay the overdue invoice or contact us.", { reason: hold.reason });
  if (!options.weekly) return;
  const profile = await db.partnerProfile.findUnique({ where: { userId }, select: { creditLimitPence: true } });
  if (profile?.creditLimitPence === null || profile?.creditLimitPence === undefined) return;
  const current = await exposure(userId);
  if (current.totalPence + (options.additionalPence ?? 0) > profile.creditLimitPence) {
    throw new AppError("PAYMENT_REQUIRED", `This booking would take you over your ${formatPence(profile.creditLimitPence)} credit limit. Pay an open invoice or pay this booking by card.`, {
      creditLimitPence: profile.creditLimitPence,
      exposurePence: current.totalPence,
    });
  }
}

async function adminEmails() {
  const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { email: true } });
  return admins.map((admin: { email: string }) => admin.email);
}

/** Place a hold (no-op when one is already active). */
export async function placeHold(userId: string, input: { reason: string; invoiceId?: string | null; automatic: boolean; actorId?: string | null }) {
  const settings = await getSettings();
  const result = await db.$transaction(async (tx) => {
    if (await activeHold(userId, tx)) return null;
    const hold = await tx.accountHold.create({ data: { userId, reason: input.reason, invoiceId: input.invoiceId ?? null, automatic: input.automatic } });
    const paused = settings.billing.holdPausesWork ? await pauseProjectsForHold(tx, userId, input.actorId ?? null) : 0;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, companyName: true } });
    return { hold, paused, user };
  });
  if (!result) return null;
  if (result.user) {
    await sendTemplate("account_hold", result.user.email, { user_name: result.user.firstName, reason: input.reason, link: appUrl("/dashboard/billing") });
    const who = result.user.companyName || result.user.email;
    for (const email of await adminEmails()) {
      await sendEmail({ to: email, subject: `Account on hold: ${who}`, html: `<p>${who} was placed on hold: ${input.reason}.</p><p>${result.paused} open project(s) paused.</p>` });
    }
  }
  if (input.actorId) await audit(input.actorId, "hold.place", "User", userId, { reason: input.reason });
  return result.hold;
}

export const liftHoldSchema = z.object({ reason: z.string().trim().min(3, "Record why the hold is lifted.").max(300) });

/** Lift the active hold(s): resume paused work and restart turnaround clocks. */
export async function liftHold(userId: string, input: { reason: string; actorId?: string | null; onlyAutomatic?: boolean }) {
  const result = await db.$transaction(async (tx) => {
    const holds = await tx.accountHold.findMany({ where: { userId, liftedAt: null, ...(input.onlyAutomatic ? { automatic: true } : {}) } });
    if (!holds.length) return null;
    await tx.accountHold.updateMany({
      where: { id: { in: holds.map((hold: { id: string }) => hold.id) } },
      data: { liftedAt: new Date(), liftedById: input.actorId ?? null, liftReason: input.reason },
    });
    const stillHeld = await activeHold(userId, tx);
    const resumed = stillHeld ? 0 : await resumeProjectsAfterHold(tx, userId, input.actorId ?? null);
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
    return { count: holds.length, resumed, user, stillHeld: Boolean(stillHeld) };
  });
  if (!result) return { lifted: 0, resumed: 0 };
  if (result.user && !result.stillHeld) await sendTemplate("hold_lifted", result.user.email, { user_name: result.user.firstName, link: appUrl("/dashboard") });
  if (input.actorId) await audit(input.actorId, "hold.lift", "User", userId, { reason: input.reason });
  return { lifted: result.count, resumed: result.resumed };
}

/** After a payment: lift automatic holds once nothing is overdue any more. */
export async function liftAutomaticHoldsIfSettled(userId: string) {
  const overdue = await db.invoice.count({ where: { userId, status: "OVERDUE" } });
  if (overdue > 0) return { lifted: 0, resumed: 0 };
  return liftHold(userId, { reason: "Overdue invoices paid in full", onlyAutomatic: true });
}

/** Admin: lift by hold id. */
export async function adminLiftHold(actorId: string, holdId: string, input: z.input<typeof liftHoldSchema>) {
  const { reason } = liftHoldSchema.parse(input);
  const hold = await db.accountHold.findUnique({ where: { id: holdId } });
  if (!hold) throw notFound("Hold");
  if (hold.liftedAt) return { lifted: 0, resumed: 0 };
  return liftHold(hold.userId, { reason, actorId });
}

export const placeHoldSchema = z.object({ reason: z.string().trim().min(3).max(300) });

export async function adminPlaceHold(actorId: string, userId: string, input: z.input<typeof placeHoldSchema>) {
  const { reason } = placeHoldSchema.parse(input);
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw notFound("User");
  return placeHold(userId, { reason, automatic: false, actorId });
}

export async function listHolds(userId?: string) {
  const holds = await db.accountHold.findMany({
    where: userId ? { userId } : { liftedAt: null },
    include: { user: { select: { id: true, email: true, companyName: true, firstName: true, lastName: true } }, invoice: { select: { number: true } } },
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  return holds.map((hold: any) => ({
    id: hold.id as string,
    user: { id: hold.user.id as string, email: hold.user.email as string, name: (hold.user.companyName as string | null) ?? `${hold.user.firstName} ${hold.user.lastName}`.trim() },
    reason: hold.reason as string,
    invoiceNumber: (hold.invoice?.number as string | undefined) ?? null,
    automatic: hold.automatic as boolean,
    startedAt: (hold.startedAt as Date).toISOString(),
    liftedAt: hold.liftedAt ? (hold.liftedAt as Date).toISOString() : null,
    liftReason: (hold.liftReason as string | null) ?? null,
  }));
}
