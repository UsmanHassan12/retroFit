import { CircleAlert, CircleCheck, Download, FileText, Plus } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BillingButton } from "@/features/billing/components/billing-button";
import { TopupForm } from "@/features/billing/components/partner-forms";
import { getSubscription } from "@/features/billing/queries";
import { formatCurrency, formatDate } from "@/lib/format";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const [subscription, settings] = await Promise.all([getSubscription(), getSettings()]);
  const partner = subscription.planId === "partner";

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Billing"
        description="Your plan, account credit, invoices and receipts."
        actions={
          !partner ? (
            <ButtonLink href="/dashboard/billing/plans" size="lg" className="text-sm">
              Become a Premium Partner
            </ButtonLink>
          ) : undefined
        }
      />

      {subscription.hold ? (
        <p role="alert" className="mt-6 flex items-start gap-3 rounded-xl bg-danger/10 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            <strong>Your account is on hold</strong> ({subscription.hold.reason}). New bookings are paused, work on open projects has stopped and downloads are
            unavailable. Paying the overdue invoice lifts the hold automatically.
          </span>
        </p>
      ) : null}

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_472px]">
        <section aria-labelledby="current-plan" className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="success" className="text-[10px] tracking-normal normal-case">
                Current Plan
              </Badge>
              <h2 id="current-plan" className="mt-3 text-2xl font-medium text-navy">
                {subscription.planName}
              </h2>
              {subscription.partner && partner ? <p className="mt-1 text-sm text-muted">{subscription.partner.companyName}</p> : null}
            </div>
            <div className="text-right">
              <p className="text-navy">
                <span className="text-5xl font-bold tracking-tight">£{subscription.price}</span>
                {subscription.price ? <span className="text-base">/mo + VAT</span> : null}
              </p>
              {subscription.nextBillingDate ? <p className="mt-2 text-xs font-semibold text-navy">Next billing: {formatDate(subscription.nextBillingDate)}</p> : null}
            </div>
          </div>
          <ul className="mt-6 grid gap-3">
            {subscription.highlights.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-base text-muted">
                <CircleCheck className="size-5 text-brand" aria-hidden />
                {item}
              </li>
            ))}
            {subscription.partner && partner ? (
              <li className="flex items-center gap-2.5 text-base text-navy">
                <CircleCheck className="size-5 text-brand" aria-hidden />
                Your discount: {subscription.partner.discountPercent}% · paying by {subscription.partner.paymentMode === "WEEKLY" ? "weekly invoice" : "account credit"}
              </li>
            ) : null}
          </ul>
          <div className="mt-6 flex flex-wrap gap-4 border-t border-dotted border-line pt-4">
            {partner ? (
              <BillingButton intent="cancel" variant="outline" size="lg" className="text-base font-semibold">
                Give notice
              </BillingButton>
            ) : (
              <ButtonLink href="/dashboard/billing/plans" variant="outline" size="lg" className="flex-1 text-base font-semibold">
                Compare plans
              </ButtonLink>
            )}
          </div>
        </section>

        {partner && subscription.paymentMode === "ADVANCE" ? (
          <section aria-labelledby="credit" className="rounded-2xl bg-white p-4 shadow-card">
            <h2 id="credit" className="text-xl font-medium text-navy">
              Account credit
            </h2>
            <p className="mt-3 text-4xl font-bold tracking-tight text-navy">{formatCurrency(subscription.credit.balance)}</p>
            <p className="mt-2 text-xs text-muted">Each booking deducts its partner price plus VAT. Unused credit is refundable if you leave.</p>
            <div className="mt-5">
              <TopupForm minimum={settings.partner.minTopupPence / 100} />
            </div>
            <p className="mt-3 text-xs text-muted">Prefer bank transfer? Pay to StepSoft and we&apos;ll add it to your balance.</p>
          </section>
        ) : partner && subscription.paymentMode === "WEEKLY" ? (
          <section aria-labelledby="account" className="rounded-2xl bg-white p-4 shadow-card">
            <h2 id="account" className="text-xl font-medium text-navy">
              Weekly account
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Booked, not yet invoiced</dt>
                <dd className="font-semibold text-navy">{formatCurrency(subscription.outstanding.unbilled)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Invoiced, unpaid</dt>
                <dd className="font-semibold text-navy">{formatCurrency(subscription.outstanding.unpaid)}</dd>
              </div>
              {subscription.partner?.creditLimit !== null && subscription.partner?.creditLimit !== undefined ? (
                <div className="flex justify-between">
                  <dt className="text-muted">Credit limit</dt>
                  <dd className="font-semibold text-navy">{formatCurrency(subscription.partner.creditLimit)}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-4 text-xs text-muted">Invoices are issued every Friday at 17:00 UK time and are due by 18:00 the following Friday.</p>
          </section>
        ) : (
          <section aria-labelledby="payment-method" className="rounded-2xl bg-white p-4 shadow-card">
            <h2 id="payment-method" className="text-xl font-medium text-navy">
              Payment Method
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line-soft p-4 shadow-card">
              {subscription.card ? (
                <>
                  <span className="flex h-8 w-12 items-center justify-center rounded bg-navy text-[10px] font-bold text-white">{subscription.card.brand.toUpperCase()}</span>
                  <div className="flex-1">
                    <p className="font-medium text-navy capitalize">
                      {subscription.card.brand} •••• {subscription.card.last4}
                    </p>
                    <p className="text-sm text-faint">Expires {subscription.card.expires}</p>
                  </div>
                </>
              ) : (
                <p className="flex-1 text-sm text-muted">No card on file yet. One is saved when you pay through Stripe.</p>
              )}
              <BillingButton intent="portal" variant="link" className="h-auto px-0 text-xs font-semibold tracking-[0.05em] text-brand uppercase">
                Update
              </BillingButton>
            </div>
            <div className="mt-6 border-t border-dotted border-line pt-4">
              <BillingButton intent="portal" size="lg" fullWidth className="text-base font-semibold">
                <Plus aria-hidden />
                Manage cards
              </BillingButton>
            </div>
          </section>
        )}
      </div>

      <section aria-labelledby="invoices" className="mt-12">
        <h2 id="invoices" className="text-2xl font-medium text-navy">
          Invoices &amp; receipts
        </h2>
        <div className="mt-8">
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Number</TH>
                <TH>Type</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Action</TH>
              </tr>
            </THead>
            <TBody>
              {subscription.invoices.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="text-center text-muted">
                    No invoices yet.
                  </TD>
                </TR>
              ) : null}
              {subscription.invoices.map((invoice) => (
                <TR key={invoice.id}>
                  <TD>{formatDate(invoice.date)}</TD>
                  <TD>{invoice.number}</TD>
                  <TD>{invoice.kind}</TD>
                  <TD>{formatCurrency(invoice.amount)}</TD>
                  <TD className={invoice.status === "Paid" ? "text-brand" : invoice.status === "Overdue" ? "text-danger" : "text-warning"}>
                    {invoice.status}
                    {invoice.dueAt && invoice.payable ? <span className="block text-xs text-muted">due {formatDate(invoice.dueAt)}</span> : null}
                  </TD>
                  <TD className="flex flex-wrap gap-2">
                    <a href={invoice.viewUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ocean", size: "sm", className: "h-9 px-4" })} aria-label={`View ${invoice.number}`}>
                      <FileText aria-hidden />
                      View
                    </a>
                    {invoice.pdfUrl ? (
                      <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ocean", size: "sm", className: "h-9 px-4" })} aria-label={`Download ${invoice.number} as PDF`}>
                        <Download aria-hidden />
                        PDF
                      </a>
                    ) : null}
                    {invoice.payable ? (
                      <BillingButton intent="pay" fields={{ invoiceId: invoice.id }} size="sm" className="h-9 px-4">
                        Pay now
                      </BillingButton>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
