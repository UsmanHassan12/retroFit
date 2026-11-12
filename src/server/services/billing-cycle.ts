import "server-only";

import { db } from "../db";
import { appUrl } from "../env";
import { sendTemplate } from "../integrations/email";
import { billingPeriod, latestCutoff, reminderTimes } from "../rules/calendar";
import { formatPence } from "../rules/pricing";
import { purgeAbandonedUploads } from "./documents";
import { placeHold } from "./holds";
import { issueInvoice } from "./invoices";
import { getSettings, weeklySchedule, type Settings } from "./settings";

/**
 * Weekly invoicing for Premium Partners (catalogue doc → Mode B, draft rule).
 *
 * Run it on a schedule (GET /api/cron/billing with CRON_SECRET). Every step is idempotent,
 * so running it hourly is the recommended set-up: it catches up after downtime and copes
 * with BST/GMT changes, instead of relying on a single "Friday 17:00 Europe/London" trigger.
 *
 *  1. At the cut-off, one VAT invoice per weekly partner covering every booking made in the
 *     period that isn't invoiced yet (or started / delivered, per billing.invoiceBasis).
 *  2. Reminders (Wednesday, and the morning of the due date by default).
 *  3. Unpaid after the due time (+ grace): invoice OVERDUE and the account goes on hold.
 */

type Line = {
  id: string;
  orderId: string;
  serviceTitle: string;
  quantity: number;
  listPence: number;
  addonsPence: number;
  discountPence: number;
  netPence: number;
  vatPence: number;
  totalPence: number;
  order: { reference: string; confirmedAt: Date | null };
  property: { line1: string; postcode: string } | null;
  project: { reference: string; status: string; workStartedAt: Date | null; deliveredAt: Date | null; cancellationFeePence: number | null } | null;
};

function basisTime(line: Line, basis: Settings["billing"]["invoiceBasis"]) {
  if (basis === "STARTED") return line.project?.workStartedAt ?? null;
  if (basis === "DELIVERED") return line.project?.deliveredAt ?? null;
  return line.order.confirmedAt;
}

/** Invoice line for a booking line; cancelled projects bill only their cancellation fee. */
function invoiceLineFor(line: Line, settings: Settings) {
  const where = line.property ? ` — ${line.property.line1}, ${line.property.postcode}` : "";
  const project = line.project?.reference ? ` (${line.project.reference})` : "";
  if (line.project?.status === "CANCELLED") {
    const fee = line.project.cancellationFeePence ?? 0;
    if (fee <= 0) return null;
    const vat = Math.round((fee * settings.vat.rateBps) / 10_000);
    return { description: `Cancellation charge: ${line.serviceTitle}${where}${project}`, orderId: line.orderId, orderLineId: line.id, listPence: fee, discountPence: 0, netPence: fee, vatPence: vat, totalPence: fee + vat };
  }
  return {
    description: `${line.serviceTitle}${line.quantity > 1 ? ` × ${line.quantity}` : ""}${where}${project} · ${line.order.reference}`,
    orderId: line.orderId,
    orderLineId: line.id,
    listPence: line.listPence + line.addonsPence,
    discountPence: line.discountPence,
    netPence: line.netPence,
    vatPence: line.vatPence,
    totalPence: line.totalPence,
  };
}

export async function generateWeeklyInvoices(now: Date, settings: Settings) {
  const schedule = weeklySchedule(settings);
  const cutoff = latestCutoff(now, schedule);
  const period = billingPeriod(cutoff, schedule);

  const partners = await db.user.findMany({
    where: { orders: { some: { status: "CONFIRMED", paymentMethod: "WEEKLY_INVOICE", lines: { some: { invoiceLine: { is: null } } } } } },
    select: { id: true, email: true, firstName: true, companyName: true },
  });

  const created: string[] = [];
  for (const partner of partners) {
    const invoice = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`weekly:${partner.id}`}))`;
        const already = await tx.invoice.findFirst({ where: { userId: partner.id, kind: "WEEKLY", periodEnd: period.end, status: { not: "VOID" } }, select: { id: true } });
        if (already) return null;

        const lines = (await tx.orderLine.findMany({
          where: { invoiceLine: { is: null }, order: { userId: partner.id, status: "CONFIRMED", paymentMethod: "WEEKLY_INVOICE" } },
          include: {
            order: { select: { reference: true, confirmedAt: true } },
            property: { select: { line1: true, postcode: true } },
            project: { select: { reference: true, status: true, workStartedAt: true, deliveredAt: true, cancellationFeePence: true } },
          },
          orderBy: [{ createdAt: "asc" }, { position: "asc" }],
        })) as unknown as Line[];

        const due = lines.filter((line) => {
          // Cancelled bookings bill only their cancellation fee (nothing when it was free).
          if (line.project?.status === "CANCELLED") return (line.project.cancellationFeePence ?? 0) > 0;
          const at = basisTime(line, settings.billing.invoiceBasis);
          return at !== null && at <= period.end;
        });
        const billable = due.map((line) => invoiceLineFor(line, settings)).filter((row): row is NonNullable<ReturnType<typeof invoiceLineFor>> => row !== null);
        if (!billable.length) return null;

        return issueInvoice(tx, {
          userId: partner.id,
          kind: "WEEKLY",
          status: "ISSUED",
          description: `Weekly invoice — bookings to ${cutoff.toLocaleDateString("en-GB", { timeZone: settings.billing.timeZone, day: "numeric", month: "long", year: "numeric" })}`,
          lines: billable,
          periodStart: period.start,
          periodEnd: period.end,
          dueAt: period.due,
          settings,
        });
      },
      { timeout: 60_000 },
    );
    if (!invoice) continue;
    created.push(invoice.number);
    await sendTemplate("invoice_issued", partner.email, {
      user_name: partner.firstName,
      invoice_number: invoice.number,
      total: formatPence(invoice.totalPence),
      due: invoice.dueAt!.toLocaleString("en-GB", { timeZone: settings.billing.timeZone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
      link: appUrl("/dashboard/billing"),
    });
  }
  return created;
}

export async function sendInvoiceReminders(now: Date, settings: Settings) {
  const open = await db.invoice.findMany({
    where: { status: "ISSUED", dueAt: { not: null, gt: new Date(now.getTime() - 86_400_000) }, totalPence: { gt: 0 } },
    include: { user: { select: { email: true, firstName: true } } },
  });
  let sent = 0;
  for (const invoice of open) {
    const due = reminderTimes(invoice.dueAt!, settings.billing.reminders, settings.billing.timeZone).filter(
      (reminder) => reminder.at <= now && !invoice.remindersSent.includes(reminder.key) && now < invoice.dueAt!,
    );
    if (!due.length) continue;
    // One email even if several reminders are due at once (after downtime).
    await db.invoice.update({ where: { id: invoice.id }, data: { remindersSent: { push: due.map((reminder) => reminder.key) } } });
    await sendTemplate("invoice_reminder", invoice.user.email, {
      user_name: invoice.user.firstName,
      invoice_number: invoice.number,
      total: formatPence(invoice.totalPence),
      due: invoice.dueAt!.toLocaleString("en-GB", { timeZone: settings.billing.timeZone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
      link: appUrl("/dashboard/billing"),
    });
    sent++;
  }
  return sent;
}

export async function applyOverdueHolds(now: Date, settings: Settings) {
  const cutoff = new Date(now.getTime() - settings.billing.graceHours * 3_600_000);
  const overdue = await db.invoice.findMany({ where: { status: "ISSUED", dueAt: { lte: cutoff }, totalPence: { gt: 0 } }, select: { id: true, userId: true, number: true } });
  let holds = 0;
  for (const invoice of overdue) {
    await db.invoice.update({ where: { id: invoice.id }, data: { status: "OVERDUE" } });
    const hold = await placeHold(invoice.userId, { reason: `Invoice ${invoice.number} is overdue`, invoiceId: invoice.id, automatic: true });
    if (hold) holds++;
    if (settings.billing.switchToAdvanceAfterLatePayment) {
      await db.partnerProfile.updateMany({ where: { userId: invoice.userId, paymentMode: "WEEKLY" }, data: { paymentMode: "ADVANCE" } });
    }
  }
  return { overdue: overdue.length, holds };
}

/** Everything the scheduler runs. Safe to call as often as you like. */
export async function runBillingCycle(now = new Date()) {
  const settings = await getSettings();
  const invoices = await generateWeeklyInvoices(now, settings);
  const reminders = await sendInvoiceReminders(now, settings);
  const overdue = await applyOverdueHolds(now, settings);
  const purgedUploads = await purgeAbandonedUploads();
  return { ranAt: now.toISOString(), invoicesCreated: invoices, remindersSent: reminders, overdueInvoices: overdue.overdue, holdsPlaced: overdue.holds, purgedUploads };
}
