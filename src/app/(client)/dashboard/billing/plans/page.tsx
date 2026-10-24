import { CircleCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { PLANS, SUBSCRIPTION } from "@/features/billing/data";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title="Choose Your Plan" description="Scalable solutions for teams of all sizes." />

      <ul className="mt-12 grid items-center gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const current = plan.id === SUBSCRIPTION.planId;
          const dark = plan.popular;
          return (
            <li
              key={plan.id}
              className={cn(
                "relative rounded-2xl p-4 shadow-card",
                dark ? "bg-navy py-10 text-white md:-my-5" : "bg-white text-navy",
              )}
            >
              {plan.popular ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white uppercase">
                  Most Popular
                </span>
              ) : null}
              <h2 className={cn("mt-6 text-xl", dark ? "text-brand" : "text-navy")}>{plan.name}</h2>
              <p className="mt-2">
                <span className="text-5xl font-bold tracking-tight">£{plan.price}</span>
                <span className="text-base">/mo</span>
              </p>
              <p className={cn("mt-4 text-sm", dark ? "text-line" : "text-muted")}>{plan.tagline}</p>
              <ul className={cn("mt-6 grid gap-2 border-t border-dotted pt-6", dark ? "border-white/40" : "border-line")}>
                {plan.features.map((feature) => (
                  <li
                    key={feature.label}
                    className={cn("flex items-center gap-2.5 text-sm", !feature.included && (dark ? "text-white/40" : "text-faint"))}
                  >
                    {feature.included ? (
                      <CircleCheck className="size-5 text-brand" aria-hidden />
                    ) : (
                      <CircleX className="size-5 text-faint" aria-hidden />
                    )}
                    <span>
                      {feature.label}
                      {!feature.included ? <span className="sr-only"> (not included)</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant={dark ? "outline" : "primary"}
                size="lg"
                fullWidth
                disabled={current}
                className="mt-10 text-base font-semibold"
              >
                {current ? "Current Plan" : plan.id === "enterprise" ? "Contact Sales" : plan.price === 0 ? "Downgrade" : "Upgrade Now"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
