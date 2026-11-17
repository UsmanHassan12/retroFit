import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BlueprintSection } from "@/components/layout/blueprint";
import { CheckoutHeader } from "@/features/checkout/components/checkout-header";
import { TestPaymentForm } from "@/features/checkout/components/test-payment-form";
import { requireSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/format";
import { firstParam } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getTestPayment } from "@/server/services/orders";

export const metadata: Metadata = { title: "Test payment", robots: { index: false } };

const money = (pence: number) => formatCurrency(pence / 100);

/** Where card checkout lands while Stripe isn't configured (dev, DEMO_MODE or TEST_PAYMENTS). */
export default async function TestPaymentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const reference = firstParam((await searchParams).order);
  const session = await requireSession(`/checkout/test-payment${reference ? `?order=${reference}` : ""}`);
  const result = reference ? await getTestPayment(await requireUser(), reference) : null;
  if (!result || !result.enabled) notFound();

  const { order, cardPence } = result;
  if (order.status === "CONFIRMED") redirect(`/checkout/confirmation?order=${order.reference}`);
  if (order.status !== "PENDING_PAYMENT") redirect(order.service?.slug ? `/checkout/${order.service.slug}` : "/services");

  const backHref = order.service?.slug ? `/checkout/${order.service.slug}/payment?cancelled=1` : "/services";
  const credit = order.breakdown.creditAppliedPence;

  return (
    <BlueprintSection innerClassName="pb-24">
      <CheckoutHeader title="Payment" backHref={backHref} backLabel="Back to your order" step={2} />
      <div className="mx-auto grid max-w-[960px] gap-6 px-4 md:grid-cols-[1fr_360px]">
        <section className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
          <h2 className="text-lg font-semibold text-navy">Card details</h2>
          <div className="mt-6">
            <TestPaymentForm reference={order.reference} amount={money(cardPence)} backHref={backHref} defaultName={session.name} />
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-navy">Order summary</h2>
          <p className="mt-1 text-sm text-muted">Order {order.reference}</p>
          <ul className="mt-5 grid gap-3 border-t border-dotted border-line pt-5 text-sm">
            {order.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-4 text-navy">
                <span>
                  {line.serviceTitle}
                  {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                </span>
                <span className="font-medium">{money(line.totalPence)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid gap-2 border-t border-dotted border-line pt-5 text-sm">
            {order.breakdown.discountPence > 0 ? (
              <div className="flex justify-between text-muted">
                <dt>Discount</dt>
                <dd>−{money(order.breakdown.discountPence)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-muted">
              <dt>VAT</dt>
              <dd>{money(order.breakdown.vatPence)}</dd>
            </div>
            <div className="flex justify-between text-navy">
              <dt>Total (incl. VAT)</dt>
              <dd className="font-semibold">{money(order.breakdown.totalPence)}</dd>
            </div>
            {credit > 0 ? (
              <div className="flex justify-between text-muted">
                <dt>Paid from account credit</dt>
                <dd>−{money(credit)}</dd>
              </div>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-base font-semibold text-navy">
              <dt>To pay by card</dt>
              <dd>{money(cardPence)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </BlueprintSection>
  );
}
