import { CircleCheck, Download, Plus } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { INVOICES, PLANS, SUBSCRIPTION } from "@/features/billing/data";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Billing & Subscription" };

export default function BillingPage() {
  const plan = PLANS.find((item) => item.id === SUBSCRIPTION.planId)!;

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
                {plan.name} Plan
              </h2>
            </div>
            <div className="text-right">
              <p className="text-navy">
                <span className="text-5xl font-bold tracking-tight">£{plan.price}</span>
                <span className="text-base">/mo</span>
              </p>
              <p className="mt-2 text-xs font-semibold text-navy">Next billing: {formatDate(SUBSCRIPTION.nextBillingDate)}</p>
            </div>
          </div>
          <ul className="mt-6 grid gap-3">
            {SUBSCRIPTION.highlights.map((item) => (
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
            <Button size="lg" className="text-base font-semibold">
              Cancel
            </Button>
          </div>
        </section>

        <section aria-labelledby="payment-method" className="rounded-2xl bg-white p-4 shadow-card">
          <h2 id="payment-method" className="text-xl font-medium text-navy">
            Payment Method
          </h2>
          <div className="mt-4 flex items-center gap-4 rounded-xl border border-line-soft p-4 shadow-card">
            <span className="flex h-8 w-12 items-center justify-center rounded bg-navy text-[10px] font-bold text-white">
              {SUBSCRIPTION.card.brand.toUpperCase()}
            </span>
            <div className="flex-1">
              <p className="font-medium text-navy">
                {SUBSCRIPTION.card.brand} •••• {SUBSCRIPTION.card.last4}
              </p>
              <p className="text-sm text-faint">Expires {SUBSCRIPTION.card.expires}</p>
            </div>
            <button type="button" className="text-xs font-semibold tracking-[0.05em] text-brand uppercase hover:underline">
              Update
            </button>
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            Your default payment method is used for all recurring subscription charges and project extras.
          </p>
          <div className="mt-6 border-t border-dotted border-line pt-4">
            <Button size="lg" fullWidth className="text-base font-semibold">
              <Plus aria-hidden />
              Add Backup Method
            </Button>
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
              {INVOICES.map((invoice) => (
                <TR key={invoice.id}>
                  <TD>{formatDate(invoice.date)}</TD>
                  <TD>{formatCurrency(invoice.amount)}</TD>
                  <TD className="text-brand">{invoice.status}</TD>
                  <TD>
                    <Button variant="ocean" size="sm" className="h-9 px-4" aria-label={`Download invoice ${invoice.id} as PDF`}>
                      <Download aria-hidden />
                      PDF
                    </Button>
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
