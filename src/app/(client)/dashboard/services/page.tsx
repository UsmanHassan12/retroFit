import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { ServiceCard } from "@/features/services/components/service-card";
import { ServiceFilters } from "@/features/services/components/service-filters";
import { getServices, isBudgetRange, isServiceCategory } from "@/features/services/queries";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Start a New Project" };

/**
 * Signed-in version of /services: the same catalogue and filters, inside the client dashboard
 * so the sidebar, notifications and account stay visible while a client picks a service.
 */
export default async function DashboardServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Start a New Project"
        description="Choose a retrofit service. Your project is created as soon as the order is confirmed."
      />

      <div className="mt-8">
        {/* useSearchParams() needs a Suspense boundary. */}
        <Suspense fallback={<div className="h-[180px]" />}>
          <ServiceFilters />
        </Suspense>
      </div>

      <section aria-live="polite" className="mt-10">
        <h2 className="sr-only">
          {services.length} {services.length === 1 ? "service" : "services"} found
        </h2>
        {services.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {services.map((service, index) => (
              <li key={service.slug} className="overflow-hidden rounded-2xl bg-white shadow-card">
                <ServiceCard service={service} priority={index < 3} basePath="/dashboard/services" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl bg-white px-6 py-20 text-center shadow-card">
            <p className="text-lg font-semibold text-navy">No services match those filters.</p>
            <p className="mt-2 text-muted">Try a different category or budget.</p>
            <ButtonLink href="/dashboard/services" variant="outline" className="mt-6">
              Clear filters
            </ButtonLink>
          </div>
        )}
      </section>
    </div>
  );
}
