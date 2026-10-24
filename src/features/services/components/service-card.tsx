import { BadgeCheck, Clock } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";

import { startingPrice } from "../queries";
import type { Service } from "../types";

export function ServiceCard({ service, priority = false }: { service: Service; priority?: boolean }) {
  return (
    <article className="group flex h-full flex-col p-6 transition-colors hover:bg-white/70">
      <div className="relative aspect-[314/236] overflow-hidden rounded-md">
        <Image
          src={service.image}
          alt=""
          fill
          priority={priority}
          sizes="(min-width: 1024px) 314px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <Badge tone="brand" className="absolute top-3 left-3 rounded-[4px] px-2 py-1">
          {service.badge}
        </Badge>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.05em] text-brand uppercase">
          <BadgeCheck className="size-3.5" aria-hidden />
          Verified Professional
        </p>
        <ul className="flex gap-2" aria-label="Eligible schemes">
          {service.schemes.map((scheme) => (
            <li key={scheme}>
              <Badge tone="success" className="rounded-[4px] px-2 py-0.5 font-semibold tracking-normal">
                {scheme}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      <h3 className="mt-4 text-xl font-semibold tracking-[-0.035em] text-navy">{service.title}</h3>
      <p className="mt-2 flex-1 text-base tracking-[-0.04em] text-muted">{service.summary}</p>

      <div className="mt-5 flex items-end justify-between">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Clock className="size-3.5" aria-hidden />
          {service.turnaround}
        </p>
        <p className="text-right">
          <span className="block text-xs font-semibold tracking-[0.05em] text-muted">FROM</span>
          <span className="text-2xl font-bold tracking-tight text-navy">{formatPrice(startingPrice(service))}</span>
        </p>
      </div>

      <ButtonLink
        href={`/services/${service.slug}`}
        className="mt-6"
        fullWidth
        aria-label={`View details for ${service.title}`}
      >
        View Details
      </ButtonLink>
    </article>
  );
}
