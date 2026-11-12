import { BadgeCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { BlueprintSection } from "@/components/layout/blueprint";
import { UrlTabs } from "@/components/ui/url-tabs";
import {
  CompliancePanel,
  IncludedPanel,
  OverviewPanel,
  TimelinePanel,
} from "@/features/services/components/detail-panels";
import { PricingPanel } from "@/features/services/components/pricing-panel";
import { ServiceGallery } from "@/features/services/components/service-gallery";
import { getBuyerPricing, getServiceBySlug, startingPrice } from "@/features/services/queries";
import { siteConfig } from "@/lib/site";

type Params = { slug: string };

/** Rendered per request from the catalogue in Postgres, so admin edits show immediately. */
export const dynamic = "force-dynamic";

/**
 * Shared shell for the service detail screens (Figma: Services / Included / Time / Compliance).
 * All four panels are rendered here and switched instantly in the browser; each tab still has
 * its own URL (/included, /timeline, /compliance) for deep links and SEO. The child pages only
 * supply per-tab metadata.
 */
export default async function ServiceDetailLayout({
  params,
  children,
}: {
  params: Promise<Params>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const buyer = await getBuyerPricing(service.id);
  const base = `/services/${service.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.headline,
    description: service.intro,
    provider: { "@type": "Organization", name: siteConfig.name },
    areaServed: "GB",
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: startingPrice(service),
      priceSpecification: { "@type": "UnitPriceSpecification", price: startingPrice(service), priceCurrency: "GBP", unitText: service.pricing.unitLabel, valueAddedTaxIncluded: false },
    },
  };

  return (
    <>
      {/* The tab page's scroll anchor: first in the DOM so navigation lands at the top. */}
      {children}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <BlueprintSection innerClassName="px-4 py-16 text-center sm:py-[70px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold tracking-[0.05em] text-brand-700 uppercase">
          <BadgeCheck className="size-3.5" aria-hidden />
          PAS 2035 Certified
        </span>
        <h1 className="font-display mx-auto mt-4 max-w-[760px] text-[34px] leading-[1.1] font-bold tracking-[-0.02em] text-balance text-navy sm:text-[48px]">
          {service.headline}
        </h1>
        <p className="mx-auto mt-6 max-w-[620px] text-lg tracking-[-0.04em] text-subtle sm:text-xl">{service.intro}</p>
      </BlueprintSection>

      <BlueprintSection corners={false} innerClassName="px-4 py-8 lg:px-2">
        <div className="grid items-start gap-6 lg:grid-cols-[690px_1fr] lg:gap-5">
          <ServiceGallery images={service.gallery} title={service.headline} />
          <div className="lg:sticky lg:top-32">
            <PricingPanel service={service} buyer={buyer} />
          </div>
        </div>
      </BlueprintSection>

      <BlueprintSection corners={false} innerClassName="px-4 pb-20 lg:px-[22px]">
        <UrlTabs
          label="Service details"
          tabs={[
            { href: base, label: "Overview", exact: true, content: <OverviewPanel service={service} /> },
            { href: `${base}/included`, label: "What’s Included", content: <IncludedPanel service={service} /> },
            { href: `${base}/timeline`, label: "Timeline", content: <TimelinePanel service={service} /> },
            { href: `${base}/compliance`, label: "Compliance", content: <CompliancePanel service={service} /> },
          ]}
        />
      </BlueprintSection>
    </>
  );
}
