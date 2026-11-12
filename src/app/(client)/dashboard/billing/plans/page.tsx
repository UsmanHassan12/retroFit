import { CircleCheck, CircleX } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { BillingButton } from "@/features/billing/components/billing-button";
import { PartnerApplyForm, PartnerSignForm } from "@/features/billing/components/partner-forms";
import { getPlans, getSubscription } from "@/features/billing/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansPage() {
  const [plans, subscription] = await Promise.all([getPlans(), getSubscription()]);

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title="Choose Your Plan" description="Basic for one-off jobs. Premium Partner for installers, agents and housing providers with repeat work." />

      <ul className="mt-12 grid items-start gap-6 md:grid-cols-2">
        {plans.map((plan) => {
          const current = plan.id === subscription.planId;
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
                  For repeat work
                </span>
              ) : null}
              <h2 className={cn("mt-6 text-xl", dark ? "text-brand" : "text-navy")}>{plan.name}</h2>
              <p className="mt-2">
                <span className="text-5xl font-bold tracking-tight">£{plan.price}</span>
                <span className="text-base">{plan.price ? "/mo + VAT" : ""}</span>
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
              <div className="mt-10 flex flex-wrap">
                {current ? (
                  <Button variant={dark ? "outline" : "primary"} size="lg" fullWidth disabled className="text-base font-semibold">
                    Current Plan
                  </Button>
                ) : plan.id === "basic" ? (
                  <p className="text-sm text-muted">Everyone starts on Basic. No subscription.</p>
                ) : subscription.nextStep === "APPLY" ? (
                  <PartnerApplyForm />
                ) : subscription.nextStep === "WAIT_FOR_APPROVAL" ? (
                  <Button variant="outline" size="lg" fullWidth disabled className="text-base font-semibold">
                    Application received — we&apos;ll be in touch
                  </Button>
                ) : subscription.nextStep === "SIGN_AGREEMENT" && subscription.agreement ? (
                  <div className="grid w-full gap-3">
                    <p className="text-sm">
                      Approved: {subscription.partner?.discountPercent}% off list prices, paying by{" "}
                      {subscription.partner?.paymentMode === "WEEKLY" ? "weekly invoice" : "account credit"}. Sign to continue.
                    </p>
                    <PartnerSignForm version={subscription.agreement.version} clauses={subscription.agreement.clauses} />
                  </div>
                ) : subscription.nextStep === "SUBSCRIBE" ? (
                  <BillingButton intent="subscribe" variant={dark ? "outline" : "primary"} size="lg" fullWidth className="text-base font-semibold">
                    Start subscription and activate
                  </BillingButton>
                ) : (
                  <ButtonLink href="mailto:accounts@stepsoft.co.uk?subject=Premium%20Partner%20account" variant={dark ? "outline" : "primary"} size="lg" fullWidth className="text-base font-semibold">
                    Contact us
                  </ButtonLink>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
