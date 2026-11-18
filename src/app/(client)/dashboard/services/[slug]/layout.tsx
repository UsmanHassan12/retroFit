import { BadgeCheck, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UrlTabs } from "@/components/ui/url-tabs";
import {
  CompliancePanel,
  IncludedPanel,
  OverviewPanel,
  TimelinePanel,
} from "@/features/services/components/detail-panels";
import { PricingPanel } from "@/features/services/components/pricing-panel";
import { ServiceGallery } from "@/features/services/components/service-gallery";
import { getBuyerPricing, getServiceBySlug } from "@/features/services/queries";

export const dynamic = "force-dynamic";

/**
 * Service detail inside the client dashboard (same panels as /services/[slug]).
 * "Start Project" continues to /dashboard/checkout so the whole order stays in the dashboard.
 */
export default async function DashboardServiceLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const buyer = await getBuyerPricing(service.id);
  const base = `/dashboard/services/${service.slug}`;

  return (
    <div className="mx-auto max-w-[1120px]">
      {/* The tab page's scroll anchor: first in the DOM so navigation lands at the top. */}
      {children}
      <Link href="/dashboard/services" className="inline-flex items-center gap-1 text-base text-muted transition-colors hover:text-navy">
        <ChevronLeft className="size-4" aria-hidden />
        Back to services
      </Link>

      <div className="mt-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold tracking-[0.05em] text-brand-700 uppercase">
          <BadgeCheck className="size-3.5" aria-hidden />
          PAS 2035 Certified
        </span>
        <h1 className="font-display mt-4 max-w-[760px] text-[30px] leading-[1.15] font-bold tracking-[-0.01em] text-navy sm:text-[40px]">
          {service.headline}
        </h1>
        <p className="mt-3 max-w-[760px] text-lg text-muted">{service.intro}</p>
      </div>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ServiceGallery images={service.gallery} title={service.headline} />
        <div className="xl:sticky xl:top-6">
          <PricingPanel service={service} buyer={buyer} checkoutBase="/dashboard/checkout" />
        </div>
      </div>

      <div className="mt-10">
        <UrlTabs
          label="Service details"
          tabs={[
            { href: base, label: "Overview", exact: true, content: <OverviewPanel service={service} /> },
            { href: `${base}/included`, label: "What’s Included", content: <IncludedPanel service={service} /> },
            { href: `${base}/timeline`, label: "Timeline", content: <TimelinePanel service={service} /> },
            { href: `${base}/compliance`, label: "Compliance", content: <CompliancePanel service={service} /> },
          ]}
        />
      </div>
    </div>
  );
}
