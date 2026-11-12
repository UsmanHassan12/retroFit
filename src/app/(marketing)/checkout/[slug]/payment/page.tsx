import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlueprintSection } from "@/components/layout/blueprint";
import { CheckoutHeader } from "@/features/checkout/components/checkout-header";
import { ReceiptCard } from "@/features/checkout/components/receipt-card";
import { resolveSelection, selectionQuery } from "@/features/checkout/lib/order";
import { getCheckoutContext, quoteSelection } from "@/features/checkout/queries";
import { getServiceBySlug } from "@/features/services/queries";
import { requireSession } from "@/lib/auth/guards";
import { firstParam } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Complete your order", robots: { index: false } };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompleteOrderPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  await requireSession(`/checkout/${slug}/payment`);
  const user = await requireUser();

  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const selection = resolveSelection(service, { qty: firstParam(query.qty), addons: firstParam(query.addons) });
  const [quote, context] = await Promise.all([quoteSelection(user, selection), getCheckoutContext(user, selection)]);
  const serviceForm = context.intake.services[0];
  const query_ = selectionQuery(selection);
  const params_ = new URLSearchParams(query_);

  return (
    <BlueprintSection innerClassName="pb-24">
      <CheckoutHeader title="Complete Your Order" backHref={`/checkout/${service.slug}${query_ ? `?${query_}` : ""}`} backLabel="Back to Order Review" step={2} />
      <div className="px-4">
        <ReceiptCard
          slug={service.slug}
          qty={params_.get("qty") ?? "1"}
          addons={params_.get("addons") ?? ""}
          tier={quote.tier}
          totals={quote.totals}
          discountSource={quote.discountSource}
          vatPercent={quote.vatRateBps / 100}
          paymentMethods={quote.paymentMethods}
          requiresProperty={service.pricing.requiresProperty}
          needsVisit={context.needsVisit}
          properties={context.properties}
          slots={context.slots}
          orderQuestions={context.intake.common.filter((question) => question.scope === "ORDER")}
          lineQuestions={[...context.intake.common.filter((question) => question.scope === "LINE"), ...(serviceForm?.questions ?? [])]}
          facts={context.facts}
          notice={firstParam(query.cancelled) ? "Payment was cancelled. Your card hasn’t been charged — you can try again below." : undefined}
        />
      </div>
    </BlueprintSection>
  );
}
