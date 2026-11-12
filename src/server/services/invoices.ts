import "server-only";

import { z } from "zod";

import { isStaff } from "../auth/permissions";
import type { AuthUser } from "../auth/session";
import { db, type Tx } from "../db";
import { appUrl, integrations, isProduction } from "../env";
import { AppError, conflict, notConfigured, notFound } from "../errors";
import { INVOICE_KINDS, INVOICE_STATUSES } from "../domain";
import { requireStripe } from "../integrations/stripe";
import { formatPence } from "../rules/pricing";
import { audit } from "./audit";
import { nextInvoiceNumber } from "./references";
import { getSettings, type Settings } from "./settings";

/**
 * Invoices and VAT receipts. One table covers every money document:
 *   ORDER         VAT receipt for a card / credit booking (status PAID)
 *   WEEKLY        partner weekly invoice (ISSUED → PAID / OVERDUE)
 *   SUBSCRIPTION  Premium Partner subscription (from Stripe)
 *   CREDIT_TOPUP  receipt for an account-credit top-up
 *   CHARGE        cancellation / failed-visit charge, or a credit note (negative)
 * The seller block (StepSoft name, address, VAT number) is snapshotted on every invoice.
 */

export type InvoiceLineInput = {
  description: string;
  orderId?: string | null;
  orderLineId?: string | null;
  listPence?: number;
  discountPence?: number;
  netPence: number;
  vatPence: number;
  totalPence: number;
};

export async function issueInvoice(
  tx: Tx,
  input: {
    userId: string;
    kind: (typeof INVOICE_KINDS)[number];
    status?: "ISSUED" | "PAID";
    description: string;
    lines: InvoiceLineInput[];
    periodStart?: Date | null;
    periodEnd?: Date | null;
    dueAt?: Date | null;
    paidAt?: Date | null;
    paidVia?: string | null;
    stripePaymentIntentId?: string | null;
    settings: Settings;
  },
) {
  const subtotalPence = input.lines.reduce((sum, line) => sum + line.netPence, 0);
  const vatPence = input.lines.reduce((sum, line) => sum + line.vatPence, 0);
  const totalPence = input.lines.reduce((sum, line) => sum + line.totalPence, 0);
  return tx.invoice.create({
    data: {
      number: await nextInvoiceNumber(tx),
      userId: input.userId,
      kind: input.kind,
      status: input.status ?? "ISSUED",
      description: input.description,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      subtotalPence,
      vatPence,
      totalPence,
      vatRateBps: input.settings.vat.rateBps,
      seller: input.settings.seller,
      dueAt: input.dueAt ?? null,
      paidAt: input.paidAt ?? (input.status === "PAID" ? new Date() : null),
      paidVia: input.paidVia ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      lines: {
        create: input.lines.map((line) => ({
          description: line.description,
          orderId: line.orderId ?? null,
          orderLineId: line.orderLineId ?? null,
          listPence: line.listPence ?? line.netPence,
          discountPence: line.discountPence ?? 0,
          netPence: line.netPence,
          vatPence: line.vatPence,
          totalPence: line.totalPence,
        })),
      },
    },
    include: { lines: true },
  });
}

export function toInvoiceDto(invoice: any) {
  return {
    id: invoice.id as string,
    number: invoice.number as string,
    kind: invoice.kind as string,
    status: invoice.status as string,
    description: invoice.description as string,
    periodStart: invoice.periodStart ? (invoice.periodStart as Date).toISOString() : null,
    periodEnd: invoice.periodEnd ? (invoice.periodEnd as Date).toISOString() : null,
    subtotalPence: invoice.subtotalPence as number,
    vatPence: invoice.vatPence as number,
    totalPence: invoice.totalPence as number,
    /** Kept for the existing billing table (it shows one amount). */
    amountPence: invoice.totalPence as number,
    issuedAt: (invoice.issuedAt as Date).toISOString(),
    dueAt: invoice.dueAt ? (invoice.dueAt as Date).toISOString() : null,
    paidAt: invoice.paidAt ? (invoice.paidAt as Date).toISOString() : null,
    paidVia: (invoice.paidVia as string | null) ?? null,
    pdfUrl: (invoice.pdfUrl as string | null) ?? null,
    viewUrl: `/api/invoices/${invoice.id}/document`,
    lines: (invoice.lines ?? []).map((line: any) => ({
      description: line.description as string,
      orderId: (line.orderId as string | null) ?? null,
      listPence: line.listPence as number,
      discountPence: line.discountPence as number,
      netPence: line.netPence as number,
      vatPence: line.vatPence as number,
      totalPence: line.totalPence as number,
    })),
    customer: invoice.user ? { id: invoice.user.id as string, email: invoice.user.email as string, name: `${invoice.user.firstName} ${invoice.user.lastName}`.trim(), companyName: (invoice.user.companyName as string | null) ?? null } : undefined,
  };
}
export type InvoiceDto = ReturnType<typeof toInvoiceDto>;

const invoiceInclude = { lines: true, user: { select: { id: true, email: true, firstName: true, lastName: true, companyName: true } } } as const;

export async function listMyInvoices(user: Pick<AuthUser, "id">, take = 50) {
  const invoices = await db.invoice.findMany({ where: { userId: user.id, status: { not: "DRAFT" } }, include: invoiceInclude, orderBy: { issuedAt: "desc" }, take });
  return invoices.map(toInvoiceDto);
}

/** Owner, or staff. Others get a 404. */
export async function getInvoice(user: AuthUser, id: string) {
  const invoice = await db.invoice.findFirst({ where: { id, ...(isStaff(user) ? {} : { userId: user.id }) }, include: invoiceInclude });
  if (!invoice) throw notFound("Invoice");
  return invoice;
}

export const adminInvoiceFiltersSchema = z.object({
  status: z.enum(INVOICE_STATUSES).optional(),
  kind: z.enum(INVOICE_KINDS).optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function adminListInvoices(input: Record<string, string> = {}) {
  const filters = adminInvoiceFiltersSchema.parse(input);
  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
  };
  const [total, invoices] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({ where, include: invoiceInclude, orderBy: { issuedAt: "desc" }, skip: (filters.page - 1) * filters.pageSize, take: filters.pageSize }),
  ]);
  return { total, page: filters.page, pageSize: filters.pageSize, invoices: invoices.map(toInvoiceDto) };
}

// ─── Paying ─────────────────────────────────────────────────────────────────

/**
 * Mark an invoice paid (Stripe webhook, dev shortcut, or an admin recording a bank transfer).
 * Idempotent. Returns the user id so the caller can lift holds.
 */
export async function markInvoicePaid(invoiceId: string, payment: { via: string; note?: string | null; paymentIntentId?: string | null; actorId?: string | null }) {
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw notFound("Invoice");
    if (invoice.status === "PAID") return { invoice, changed: false };
    if (invoice.status === "VOID" || invoice.status === "DRAFT") throw conflict("This invoice can't be paid.");
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date(), paidVia: payment.via, paidNote: payment.note ?? null, stripePaymentIntentId: payment.paymentIntentId ?? invoice.stripePaymentIntentId },
    });
    return { invoice: updated, changed: true };
  });
  if (result.changed && payment.actorId) await audit(payment.actorId, "invoice.mark_paid", "Invoice", invoiceId, { via: payment.via, note: payment.note });
  return result;
}

/** Card payment for an open invoice (weekly or charge). Without Stripe in dev it's paid at once. */
export async function payInvoiceCheckout(user: AuthUser, id: string, ensureCustomer: (user: AuthUser) => Promise<string>) {
  const invoice = await db.invoice.findFirst({ where: { id, userId: user.id } });
  if (!invoice) throw notFound("Invoice");
  if (invoice.status === "PAID") return { url: appUrl("/dashboard/billing?paid=1"), paid: true };
  if (invoice.status !== "ISSUED" && invoice.status !== "OVERDUE") throw conflict("This invoice can't be paid online.");
  if (invoice.totalPence <= 0) throw conflict("Nothing to pay on this invoice.");

  if (!integrations.stripe()) {
    if (isProduction()) throw notConfigured("Payments are not configured.");
    return { url: appUrl("/dashboard/billing?paid=1"), paid: true, devPaid: true as const };
  }
  const session = await requireStripe().checkout.sessions.create({
    mode: "payment",
    customer: await ensureCustomer(user),
    client_reference_id: invoice.id,
    metadata: { kind: "invoice", invoiceId: invoice.id },
    payment_intent_data: { metadata: { kind: "invoice", invoiceId: invoice.id } },
    line_items: [{ quantity: 1, price_data: { currency: "gbp", unit_amount: invoice.totalPence, product_data: { name: `Invoice ${invoice.number}`, description: invoice.description } } }],
    success_url: appUrl("/dashboard/billing?paid=1"),
    cancel_url: appUrl("/dashboard/billing"),
  });
  await db.invoice.update({ where: { id: invoice.id }, data: { stripeSessionId: session.id } });
  return { url: session.url!, paid: false };
}

/** Admin: void an issued invoice. Its booking lines are released so they can be billed again. */
export async function voidInvoice(actorId: string, id: string, reason: string) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw notFound("Invoice");
  if (invoice.status === "PAID") throw new AppError("CONFLICT", "Paid invoices can't be voided. Issue a credit note instead.");
  await db.$transaction([
    db.invoiceLine.updateMany({ where: { invoiceId: id }, data: { orderLineId: null } }),
    db.invoice.update({ where: { id }, data: { status: "VOID", paidNote: reason } }),
  ]);
  await audit(actorId, "invoice.void", "Invoice", id, { reason });
}

// ─── Printable VAT invoice ──────────────────────────────────────────────────

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const day = (date: Date | null) => (date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }) : "");

/** HTML VAT invoice (print to PDF from the browser). Shows seller, VAT number, number, date and VAT. */
export async function renderInvoiceDocument(user: AuthUser, id: string) {
  const invoice = await getInvoice(user, id);
  const seller = (invoice.seller as Settings["seller"] | null) ?? (await getSettings()).seller;
  const buyer = invoice.user;
  const vatPercent = (invoice.vatRateBps / 100).toFixed(invoice.vatRateBps % 100 === 0 ? 0 : 2);
  const rows = invoice.lines
    .map(
      (line: any) =>
        `<tr><td>${escape(line.description)}</td><td class="n">${formatPence(line.listPence)}</td><td class="n">${line.discountPence ? `−${formatPence(line.discountPence)}` : "—"}</td><td class="n">${formatPence(line.netPence)}</td><td class="n">${formatPence(line.vatPence)}</td><td class="n">${formatPence(line.totalPence)}</td></tr>`,
    )
    .join("");
  const title = invoice.kind === "WEEKLY" || invoice.status !== "PAID" ? "VAT invoice" : "VAT receipt";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} ${escape(invoice.number)}</title><style>
body{font-family:Inter,Arial,sans-serif;color:#0b1c30;margin:40px;font-size:13px}h1{font-size:22px;margin:0}
.grid{display:flex;justify-content:space-between;gap:24px;margin:24px 0}table{width:100%;border-collapse:collapse;margin-top:16px}
th,td{padding:8px;border-bottom:1px solid #e3e8ef;text-align:left}th{background:#f4f7fa}.n{text-align:right;white-space:nowrap}
.totals{margin-left:auto;width:280px;margin-top:16px}.totals div{display:flex;justify-content:space-between;padding:4px 0}
.muted{color:#6b7a90}.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef3f8;font-size:11px;font-weight:600}
@media print{body{margin:16mm}}</style></head><body>
<h1>${title}</h1><p class="muted">${escape(invoice.number)} · Issued ${day(invoice.issuedAt)} <span class="badge">${invoice.status}</span></p>
<div class="grid"><div><strong>${escape(seller.name)}</strong><br>${escape(seller.tradingAs)}<br>${escape(seller.address)}<br>VAT no. ${escape(seller.vatNumber)}<br>${escape(seller.email)}</div>
<div><strong>Bill to</strong><br>${escape(buyer.companyName ?? `${buyer.firstName} ${buyer.lastName}`)}<br>${escape(buyer.email)}${
    invoice.periodStart && invoice.periodEnd ? `<br><br><strong>Period</strong><br>${day(invoice.periodStart)} – ${day(invoice.periodEnd)}` : ""
  }${invoice.dueAt ? `<br><strong>Due</strong> ${invoice.dueAt.toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "long", timeStyle: "short" })} UK time` : ""}</div></div>
<p>${escape(invoice.description)}</p>
<table><thead><tr><th>Item</th><th class="n">List</th><th class="n">Discount</th><th class="n">Net</th><th class="n">VAT ${vatPercent}%</th><th class="n">Total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span>Subtotal</span><span>${formatPence(invoice.subtotalPence)}</span></div><div><span>VAT at ${vatPercent}%</span><span>${formatPence(invoice.vatPence)}</span></div><div><strong>Total</strong><strong>${formatPence(invoice.totalPence)}</strong></div></div>
${invoice.paidAt ? `<p class="muted">Paid ${day(invoice.paidAt)}${invoice.paidVia ? ` by ${escape(invoice.paidVia.toLowerCase().replace(/_/g, " "))}` : ""}.</p>` : ""}
</body></html>`;
}
