"use client";

import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { useState } from "react";

import { cn, initials } from "@/lib/utils";

const TESTIMONIALS = [
  {
    quote:
      "The platform made navigating PAS 2035 compliance simple. I received my assessment within a week and the coordinator was incredibly helpful.",
    name: "James Sterling",
    role: "Homeowner, London",
  },
  {
    quote:
      "We moved 40 properties through ECO4 without a single lodgement rejection. Having every document in one place changed everything.",
    name: "Priya Shah",
    role: "Asset Manager, Housing Association",
  },
  {
    quote:
      "Clear fixed pricing, a named coordinator and weekly updates. Exactly what landlords need to plan upgrades with confidence.",
    name: "Tom Whitaker",
    role: "Landlord, Manchester",
  },
  {
    quote:
      "The funding team handled our GBIS application end to end. Our insulation was fitted within six weeks of booking.",
    name: "Aisha Rahman",
    role: "Homeowner, Leeds",
  },
  {
    quote:
      "As an installer, the lead quality is excellent — every job arrives with a compliant design and survey already done.",
    name: "Daniel Okafor",
    role: "Installer, Birmingham",
  },
];

export function Testimonials() {
  const [active, setActive] = useState(2);
  const count = TESTIMONIALS.length;
  const go = (delta: number) => setActive((index) => (index + delta + count) % count);

  return (
    <div className="mx-auto max-w-[1050px] px-4 py-12 lg:px-0">
      <div
        className="relative flex h-[300px] items-center justify-center"
        role="region"
        aria-roledescription="carousel"
        aria-label="Customer testimonials"
      >
        {TESTIMONIALS.map((item, index) => {
          // Signed distance from the active card, wrapped around the ends.
          let offset = index - active;
          if (offset > count / 2) offset -= count;
          if (offset < -count / 2) offset += count;
          const distance = Math.abs(offset);
          const hidden = distance > 2;

          return (
            <figure
              key={item.name}
              aria-hidden={offset !== 0}
              className={cn(
                "absolute w-[min(349px,85vw)] rounded-[15px] border border-line-soft bg-white p-6 shadow-[0_6px_16px_-6px_rgb(11_28_48/0.21)] transition-all duration-500 ease-out",
                hidden && "pointer-events-none opacity-0",
                distance === 1 && "max-sm:opacity-0",
                distance === 2 && "max-md:opacity-0",
              )}
              style={{
                transform: `translateX(${offset * 52}%) scale(${1 - distance * 0.11})`,
                zIndex: 10 - distance,
              }}
            >
              <div className="flex gap-1 text-brand" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star key={star} className="size-5 fill-current" aria-hidden />
                ))}
              </div>
              <blockquote className="mt-6 text-base leading-6 text-navy italic">“{item.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#dce9ff] text-base font-bold text-navy">
                  {initials(item.name)}
                </span>
                <span>
                  <span className="block font-bold text-navy">{item.name}</span>
                  <span className="block text-[10px] tracking-wide text-muted uppercase">{item.role}</span>
                </span>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <div className="mt-10 flex justify-center gap-6">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous testimonial"
          className="flex size-10 items-center justify-center rounded-full bg-[#0b3a5c] text-white transition-colors hover:bg-navy"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next testimonial"
          className="flex size-10 items-center justify-center rounded-full bg-[#0b3a5c] text-white transition-colors hover:bg-navy"
        >
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        Testimonial {active + 1} of {count}: {TESTIMONIALS[active]?.name}
      </p>
    </div>
  );
}
