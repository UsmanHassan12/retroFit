import { CircleCheck, Clock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlueprintSection } from "@/components/layout/blueprint";
import { ButtonLink } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/format";
import { firstParam } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getConfirmation } from "@/server/services/orders";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

/** Stripe (or the dev shortcut) returns here with ?order=ORD-…; the project exists once payment is confirmed. */
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession("/dashboard");
  const reference = firstParam((await searchParams).order);
  const order = reference ? await getConfirmation(await requireUser(), reference) : null;
  if (!order) notFound();

  const paid = order.status === "PAID" && order.projectReference;

  return (
    <BlueprintSection innerClassName="px-4 py-24">
      {/* Payment confirmations arrive by webhook; refresh until the project exists. */}
      {!paid && order.status === "PENDING_PAYMENT" ? <meta httpEquiv="refresh" content="3" /> : null}
      <div className="mx-auto max-w-[560px] rounded-2xl bg-white p-8 text-center shadow-card sm:p-12">
        {paid ? (
          <CircleCheck className="mx-auto size-14 fill-brand text-white" aria-hidden />
        ) : (
          <Clock className="mx-auto size-14 text-warning" aria-hidden />
        )}
        <h1 className="font-display mt-6 text-3xl font-bold text-navy">
          {paid ? `Thank you, ${session.firstName}!` : "Confirming your payment…"}
        </h1>
        <p className="mt-3 text-muted">
          {paid ? (
            <>
              Your project <span className="font-semibold text-navy">{order.projectReference}</span> has been created for{" "}
              <span className="font-semibold text-navy">{order.service.title}</span>. Your coordinator will be in touch within one
              working day.
            </>
          ) : order.status === "PENDING_PAYMENT" ? (
            <>This usually takes a few seconds. This page refreshes automatically.</>
          ) : (
            <>
              Order <span className="font-semibold text-navy">{order.reference}</span> is {order.status.toLowerCase().replace("_", " ")}.
            </>
          )}
        </p>
        <p className="mt-6 text-sm text-muted">
          Order {order.reference} · {paid ? "Amount paid" : "Total"}:{" "}
          <span className="font-semibold text-navy">{formatCurrency(order.breakdown.totalPence / 100)}</span> (incl. VAT)
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={paid ? `/dashboard/projects/${order.projectReference}` : "/dashboard/projects"} size="lg">
            {paid ? "Open my project" : "Go to my projects"}
          </ButtonLink>
          <ButtonLink href="/services" variant="outline" size="lg">
            Browse more services
          </ButtonLink>
        </div>
      </div>
    </BlueprintSection>
  );
}
