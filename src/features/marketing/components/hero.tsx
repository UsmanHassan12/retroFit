import { PlayCircle } from "lucide-react";
import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";

import { TrustBadge } from "./trust-badge";

const STATS = [
  { value: "1K", suffix: "+", label: "Homes Retrofitted" },
  { value: "2.4M", label: "Funding Secured" },
  { value: "4.9/5", label: "Average Rating" },
];

export function Hero() {
  return (
    <section className="border-blueprint relative isolate overflow-hidden border-b">
      <Image
        src="/images/marketing/hero-home.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
      />
      {/* Navy wash so copy stays legible on any crop of the photo. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(11_28_48/0.88)_0%,rgb(11_28_48/0.62)_45%,rgb(11_28_48/0.35)_100%)]" />

      <div className="mx-auto flex min-h-[560px] max-w-[1092px] flex-col justify-between gap-12 px-4 py-16 sm:px-6 lg:min-h-[650px] lg:px-0 lg:py-[108px]">
        <div className="max-w-[576px]">
          <h1 className="font-display text-[36px] leading-[1.1] font-bold tracking-[-0.02em] text-balance text-white sm:text-[48px]">
            Retrofit Your Home In Weeks, Not Months — Fully Compliant &amp; Funded
          </h1>
          <p className="mt-6 max-w-[510px] text-base leading-[1.6] text-line sm:text-lg">
            Purchase PAS 2035 retrofit services online with transparent pricing, funding support, and
            end-to-end project coordination.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <ButtonLink href="/services" variant="outline" size="lg" className="min-w-[208px] border-0">
              Browse Services
            </ButtonLink>
            <ButtonLink href="/#how-it-works" variant="glass" size="lg" className="min-w-[180px]">
              <PlayCircle aria-hidden />
              Watch Video
            </ButtonLink>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-8 lg:justify-end lg:gap-10">
          <dl className="flex flex-wrap gap-8 sm:gap-10">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse items-center text-white">
                <dt className="font-accent mt-1 text-sm font-medium">{stat.label}</dt>
                <dd className="font-display text-[35px] leading-none font-bold">
                  {stat.value}
                  {stat.suffix ? <sup className="text-lg">{stat.suffix}</sup> : null}
                </dd>
              </div>
            ))}
          </dl>
          <TrustBadge />
        </div>
      </div>
    </section>
  );
}
