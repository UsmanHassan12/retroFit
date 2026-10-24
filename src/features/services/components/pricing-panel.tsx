"use client";

import { ArrowRight, Clock, FileText } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Service, TierId } from "../types";

/** Tier tabs + add-ons. "Start Project" carries the selection to the order review step via the URL. */
export function PricingPanel({ service }: { service: Service }) {
  const [tierId, setTierId] = useState<TierId>("basic");
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const baseId = useId();

  const tier = service.tiers.find((item) => item.id === tierId) ?? service.tiers[0]!;

  const checkoutHref = (() => {
    const params = new URLSearchParams({ tier: tier.id });
    if (addOnIds.length) params.set("addons", addOnIds.join(","));
    return `/checkout/${service.slug}?${params.toString()}`;
  })();

  function toggleAddOn(id: string) {
    setAddOnIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <aside
      aria-label="Choose a package"
      className="overflow-hidden rounded-2xl border border-line-soft bg-white shadow-[0_4px_12px_rgb(11_28_48/0.25)]"
    >
      <div role="tablist" aria-label="Pricing tiers" className="grid grid-cols-3 bg-navy">
        {service.tiers.map((item) => {
          const selected = item.id === tier.id;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              onClick={() => setTierId(item.id)}
              className={cn(
                "relative h-[57px] text-base transition-colors",
                selected ? "font-bold text-white" : "font-medium text-line hover:text-white",
              )}
            >
              {item.name}
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-0 bottom-0 h-[3px] bg-brand transition-opacity",
                  selected ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>

      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tier.id}`} className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-semibold tracking-tight text-navy">{formatCurrency(tier.price)}</p>
          <p className="text-sm text-muted">{tier.name} Tier</p>
        </div>
        <p className="mt-5 text-sm leading-[1.5] text-muted">{tier.summary}</p>

        <hr className="my-5 border-line-soft" />

        <ul className="grid gap-3 text-sm font-medium text-navy">
          <li className="flex items-center gap-2">
            <Clock className="size-[18px]" aria-hidden />
            {tier.deliveryDays} Days Delivery
          </li>
          {tier.inclusions.map((inclusion) => (
            <li key={inclusion} className="flex items-center gap-2">
              <FileText className="size-[18px]" aria-hidden />
              {inclusion}
            </li>
          ))}
        </ul>

        <hr className="my-5 border-line-soft" />

        <fieldset>
          <legend className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">Add-ons</legend>
          <ul className="mt-3 grid gap-2">
            {service.addOns.map((addOn) => {
              const id = `${baseId}-${addOn.id}`;
              return (
                <li key={addOn.id}>
                  <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-1 text-sm text-navy">
                    <span className="flex items-center gap-3">
                      <input
                        id={id}
                        type="checkbox"
                        checked={addOnIds.includes(addOn.id)}
                        onChange={() => toggleAddOn(addOn.id)}
                        className="size-4 rounded border-line accent-brand"
                      />
                      {addOn.name}
                    </span>
                    <span className="font-bold">+{formatPrice(addOn.price)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <Link href={checkoutHref} className={buttonVariants({ size: "lg", fullWidth: true, className: "mt-6" })}>
          Start Project
          <ArrowRight aria-hidden />
        </Link>
        <p className="mt-5 text-center text-xs text-muted">Prices exclude VAT (20%), added at checkout.</p>
      </div>
    </aside>
  );
}
