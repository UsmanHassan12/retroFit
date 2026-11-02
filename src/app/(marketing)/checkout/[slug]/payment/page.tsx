import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlueprintSection } from "@/components/layout/blueprint";
import { CheckoutHeader } from "@/features/checkout/components/checkout-header";
import { ReceiptCard } from "@/features/checkout/components/receipt-card";
import { resolveSelection, selectionQuery } from "@/features/checkout/lib/order";
import { getServiceBySlug } from "@/features/services/queries";
import { requireSession } from "@/lib/auth/guards";
import { firstParam } from "@/lib/utils";
import { PRIORITY_PLAN_DISCOUNT_PERCENT } from "@/server/domain";

export const metadata: Metadata = { title: "Complete your order", robots: { index: false } };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CompleteOrderPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const session = await requireSession(`/checkout/${slug}/payment`);

  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const selection = resolveSelection(service, {
    tier: firstParam(query.tier),
    addons: firstParam(query.addons),
  });

  return (
    <BlueprintSection innerClassName="pb-24">
      <CheckoutHeader
        title="Complete Your Order"
        backHref={`/checkout/${service.slug}?${selectionQuery(selection)}`}
        backLabel="Back to Order Review"
        step={2}
      />
      <div className="px-4">
        <ReceiptCard
          slug={service.slug}
          tierId={selection.tier.id}
          tierName={selection.tier.name}
          tierPrice={selection.tier.price}
          addOnIds={selection.addOns.map((addOn) => addOn.id)}
          addOnPrices={selection.addOns.map((addOn) => addOn.price)}
          planDiscountPercent={session.plan === "free" ? 0 : PRIORITY_PLAN_DISCOUNT_PERCENT}
          notice={firstParam(query.cancelled) ? "Payment was cancelled. Your card hasn’t been charged — you can try again below." : undefined}
        />
      </div>
    </BlueprintSection>
  );
}
