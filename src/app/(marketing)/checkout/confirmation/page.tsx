import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";

import { BlueprintSection } from "@/components/layout/blueprint";
import { ButtonLink } from "@/components/ui/button";
import { getServiceBySlug } from "@/features/services/queries";
import { requireSession } from "@/lib/auth/guards";
import { formatCurrency } from "@/lib/format";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession("/dashboard");
  const query = await searchParams;
  const reference = firstParam(query.ref) ?? "—";
  const service = await getServiceBySlug(firstParam(query.service) ?? "");
  const total = Number(firstParam(query.total));

  return (
    <BlueprintSection innerClassName="px-4 py-24">
      <div className="mx-auto max-w-[560px] rounded-2xl bg-white p-8 text-center shadow-card sm:p-12">
        <CircleCheck className="mx-auto size-14 fill-brand text-white" aria-hidden />
        <h1 className="font-display mt-6 text-3xl font-bold text-navy">Thank you, {session.name.split(" ")[0]}!</h1>
        <p className="mt-3 text-muted">
          Your project <span className="font-semibold text-navy">{reference}</span> has been created
          {service ? (
            <>
              {" "}
              for <span className="font-semibold text-navy">{service.title}</span>
            </>
          ) : null}
          . Your coordinator will be in touch within one working day.
        </p>
        {Number.isFinite(total) ? (
          <p className="mt-6 text-sm text-muted">
            Amount paid: <span className="font-semibold text-navy">{formatCurrency(total)}</span> (incl. VAT)
          </p>
        ) : null}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/dashboard/projects" size="lg">
            Go to my projects
          </ButtonLink>
          <ButtonLink href="/services" variant="outline" size="lg">
            Browse more services
          </ButtonLink>
        </div>
      </div>
    </BlueprintSection>
  );
}
