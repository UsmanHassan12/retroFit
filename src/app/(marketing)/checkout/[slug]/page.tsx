import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlueprintSection } from "@/components/layout/blueprint";
import { ButtonLink } from "@/components/ui/button";
import { CheckoutHeader } from "@/features/checkout/components/checkout-header";
import {
  IncludedDeliverables,
  OrderSummaryCard,
  SelectedAddOns,
} from "@/features/checkout/components/order-review";
import { resolveSelection, selectionQuery } from "@/features/checkout/lib/order";
import { quoteSelection } from "@/features/checkout/queries";
import { getServiceBySlug } from "@/features/services/queries";
import { requireSession } from "@/lib/auth/guards";
import { firstParam } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Review your order", robots: { index: false } };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReviewOrderPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  await requireSession(`/checkout/${slug}`);

  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const selection = resolveSelection(service, { qty: firstParam(query.qty), addons: firstParam(query.addons) });
  // Priced by the server for this customer (tier, partner discount, add-ons).
  const quote = await quoteSelection(await requireUser(), selection);

  return (
    <BlueprintSection innerClassName="pb-20">
      <CheckoutHeader
        title="Review Your Order"
        backHref={`/services/${service.slug}`}
        backLabel="Back to Service Detail"
        step={1}
      />
      <div className="mx-auto grid max-w-[958px] gap-6 px-4">
        <OrderSummaryCard service={service} quote={quote} />
        <SelectedAddOns service={service} quote={quote} />
        <IncludedDeliverables service={service} />
      </div>
      <div className="mt-20 flex justify-center px-4">
        <ButtonLink
          href={`/checkout/${service.slug}/payment${selectionQuery(selection) ? `?${selectionQuery(selection)}` : ""}`}
          size="xl"
          className="min-w-[312px] text-base"
        >
          Continue to Checkout
          <ArrowRight aria-hidden />
        </ButtonLink>
      </div>
    </BlueprintSection>
  );
}
