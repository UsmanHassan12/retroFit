import { CircleCheck, Download, Plus } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BillingButton } from "@/features/billing/components/billing-button";
import { getSubscription } from "@/features/billing/queries";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Billing & Subscription" };

export default async function BillingPage() {
  const subscription = await getSubscription();
  const paid = subscription.planId !== "free";

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your plan, payment methods, and billing history."
        actions={
          <ButtonLink href="/dashboard/billing/plans" size="lg" className="text-sm">
            Upgrade Plan
          </ButtonLink>
        }
      />

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_472px]">
        <section aria-labelledby="current-plan" className="rounded-2xl bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge tone="success" className="text-[10px] normal-case tracking-normal">
                Current Plan
              </Badge>
              <h2 id="current-plan" className="mt-3 text-2xl font-medium text-navy">
                {subscription.planName} Plan
              </h2>
            </div>
            <div className="text-right">
              <p className="text-navy">
                <span className="text-5xl font-bold tracking-tight">£{subscription.price}</span>
                <span className="text-base">/mo</span>
              </p>
              {subscription.nextBillingDate ? (
                <p className="mt-2 text-xs font-semibold text-navy">Next billing: {formatDate(subscription.nextBillingDate)}</p>
              ) : null}
            </div>
          </div>
          <ul className="mt-6 grid gap-3">
            {subscription.highlights.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-base text-muted">
                <CircleCheck className="size-5 text-brand" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex gap-4 border-t border-dotted border-line pt-4">
            <ButtonLink href="/dashboard/billing/plans" variant="outline" size="lg" className="flex-1 text-base font-semibold">
              Upgrade Plan
            </ButtonLink>
            {paid ? (
              <BillingButton intent="portal" size="lg" className="text-base font-semibold">
                Cancel
              </BillingButton>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="payment-method" className="rounded-2xl bg-white p-4 shadow-card">
          <h2 id="payment-method" className="text-xl font-medium text-navy">
            Payment Method
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line-soft p-4 shadow-card">
            {subscription.card ? (
              <>
                <span className="flex h-8 w-12 items-center justify-center rounded bg-navy text-[10px] font-bold text-white">
                  {subscription.card.brand.toUpperCase()}
                </span>
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
          <p className="mt-4 text-xs leading-5 text-muted">
            Your default payment method is used for all recurring subscription charges and project extras.
          </p>
          <div className="mt-6 border-t border-dotted border-line pt-4">
            <BillingButton intent="portal" size="lg" fullWidth className="text-base font-semibold">
              <Plus aria-hidden />
              Add Backup Method
            </BillingButton>
          </div>
        </section>
      </div>

      <section aria-labelledby="invoices" className="mt-12">
        <h2 id="invoices" className="text-2xl font-medium text-navy">
          Invoice History
        </h2>
        <div className="mt-8">
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH>Action</TH>
              </tr>
            </THead>
            <TBody>
              {subscription.invoices.length === 0 ? (
                <TR>
                  <TD colSpan={4} className="text-center text-muted">
                    No invoices yet.
                  </TD>
                </TR>
              ) : null}
              {subscription.invoices.map((invoice) => (
                <TR key={invoice.id}>
                  <TD>{formatDate(invoice.date)}</TD>
                  <TD>{formatCurrency(invoice.amount)}</TD>
                  <TD className={invoice.status === "Paid" ? "text-brand" : "text-warning"}>{invoice.status}</TD>
                  <TD>
                    {invoice.pdfUrl ? (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonVariants({ variant: "ocean", size: "sm", className: "h-9 px-4" })}
                        aria-label={`Download invoice ${invoice.number} as PDF`}
                      >
                        <Download aria-hidden />
                        PDF
                      </a>
                    ) : (
                      <span className="text-sm text-faint" title="PDFs are available for invoices issued by Stripe">
                        {invoice.number}
                      </span>
                    )}
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
