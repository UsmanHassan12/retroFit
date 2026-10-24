import Image from "next/image";
import Link from "next/link";

import { BlueprintSection, SectionHeading } from "@/components/layout/blueprint";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getFeaturedServices, startingPrice } from "@/features/services/queries";
import { formatPrice } from "@/lib/format";

export async function FeaturedServices() {
  const services = await getFeaturedServices(3);

  return (
    <>
      <BlueprintSection innerClassName="pt-16 pb-8 sm:pt-[107px]">
        <SectionHeading eyebrow="Services" title="Retrofit Services" />
        <div className="mt-12 flex justify-center">
          <Link
            href="/services"
            className="relative pb-3 text-[22px] tracking-[-0.03em] text-brand after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-brand hover:text-brand-700"
          >
            View All
          </Link>
        </div>
      </BlueprintSection>

      <BlueprintSection corners={false} innerClassName="pb-20">
        <ul className="divide-blueprint grid md:grid-cols-3 md:divide-x">
          {services.map((service) => (
            <li key={service.slug} className="group p-6 transition-colors hover:bg-white/60">
              <article className="flex h-full flex-col">
                <div className="relative aspect-[312/234] overflow-hidden rounded-md">
                  <Image
                    src={service.image}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 314px, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="mt-5 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-[-0.04em] text-navy">{service.title}</h3>
                    <Badge tone="success" className="text-[10px]">
                      {service.badge}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold tracking-[-0.04em] text-brand">
                    {formatPrice(startingPrice(service))}
                  </p>
                </div>
                <p className="mt-3 flex-1 text-base tracking-[-0.04em] text-muted">{service.summary}</p>
                <ButtonLink href={`/services/${service.slug}`} className="mt-5" fullWidth size="lg">
                  View Details
                </ButtonLink>
              </article>
            </li>
          ))}
        </ul>
      </BlueprintSection>
    </>
  );
}
