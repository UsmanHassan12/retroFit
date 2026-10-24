import type { Metadata } from "next";
import { Suspense } from "react";

import { BlueprintSection } from "@/components/layout/blueprint";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { CtaBanner } from "@/features/marketing/components/cta-banner";
import { ServiceCard } from "@/features/services/components/service-card";
import { ServiceFilters } from "@/features/services/components/service-filters";
import { getServices, isBudgetRange, isServiceCategory } from "@/features/services/queries";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Retrofit Services",
  description:
    "Browse PAS 2035 retrofit assessments, design packages, coordination and ECO4 / GBIS funding support with transparent fixed pricing.",
};

type ServicesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const params = await searchParams;
  const category = firstParam(params.category);
  const budget = firstParam(params.budget);
  const q = firstParam(params.q);

  const services = await getServices({
    q,
    category: isServiceCategory(category) ? category : undefined,
    budget: isBudgetRange(budget) ? budget : undefined,
  });

  return (
    <>
      <BlueprintSection innerClassName="pt-16 pb-10 sm:pt-[70px]">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <Badge tone="outline" dot className="normal-case tracking-normal font-normal text-sm">
            All Services
          </Badge>
          <h1 className="font-display mt-4 text-[36px] leading-[1.1] font-bold tracking-[-0.02em] text-navy sm:text-[48px]">
            Retrofit Services
          </h1>
          <p className="mt-5 text-lg tracking-[-0.04em] text-subtle sm:text-xl">
            Browse premium services designed to inspire and elevate your projects.
          </p>
        </div>

        <div className="mt-10">
          {/* useSearchParams() needs a Suspense boundary for static prerendering. */}
          <Suspense fallback={<div className="h-[180px]" />}>
            <ServiceFilters />
          </Suspense>
        </div>
        <div aria-hidden className="mx-auto mt-10 flex max-w-[1000px] items-center px-4">
          <span className="h-px flex-1 bg-line-soft" />
        </div>
      </BlueprintSection>

      <BlueprintSection corners={false} aria-live="polite">
        <h2 className="sr-only">
          {services.length} {services.length === 1 ? "service" : "services"} found
        </h2>
        {/* Each card draws its right + bottom rule; -mr-px tucks the last column under the frame. */}
        {services.length > 0 ? (
          <ul className="grid sm:-mr-px sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, index) => (
              <li key={service.slug} className="border-blueprint border-b sm:border-r">
                <ServiceCard service={service} priority={index < 3} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-6 py-24 text-center">
            <p className="text-lg font-semibold text-navy">No services match those filters.</p>
            <p className="mt-2 text-muted">Try a different category or budget.</p>
            <ButtonLink href="/services" variant="outline" className="mt-6">
              Clear filters
            </ButtonLink>
          </div>
        )}
      </BlueprintSection>

      <CtaBanner />
    </>
  );
}
