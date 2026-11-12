"use client";

import { ArrowRight, BadgeCheck, Clock, Minus, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { priceLine } from "@/server/rules/pricing";

import { addonQuery } from "../selection";
import type { Service } from "../types";

export type BuyerPricing = { signedIn: boolean; tier: "BASIC" | "PARTNER"; discountPercent: number; vatPercent: number };

/**
 * One list price per unit; the visitor's tier decides the discount and turnaround.
 * The estimate here is for display only: the server prices the order again at checkout.
 */
export function PricingPanel({ service, buyer }: { service: Service; buyer: BuyerPricing }) {
  const baseId = useId();
  const { pricing } = service;
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const partner = buyer.tier === "PARTNER";
  const addOns = service.addOns.filter((addOn) => addOn.audience === "ALL" || addOn.audience === buyer.tier);

  const expressChosen = addOns.some((addOn) => addOn.fastTrack && selected[addOn.id]);
  const fastTrack = Boolean(service.fastTrackTurnaround) && (partner || expressChosen);

  const estimate = priceLine({
    unitPricePence: Math.round(pricing.listPrice * 100),
    quantity,
    discountBps: Math.round(buyer.discountPercent * 100),
    addons: addOns
      .filter((addOn) => selected[addOn.id])
      .map((addOn) => ({
        key: addOn.id,
        name: addOn.name,
        kind: addOn.kind,
        // Pounds → pence, or percent → basis points: both × 100.
        amount: Math.round(addOn.amount * 100),
        freeAllowance: addOn.freeAllowance,
        quantity: selected[addOn.id],
      })),
    vatBps: Math.round(buyer.vatPercent * 100),
  });

  const params = new URLSearchParams();
  if (pricing.perUnit && quantity > 1) params.set("qty", String(quantity));
  const addons = addonQuery(selected);
  if (addons) params.set("addons", addons);
  const checkoutHref = `/checkout/${service.slug}${params.size ? `?${params.toString()}` : ""}`;

  const toggle = (id: string, value: number) => setSelected((current) => ({ ...current, [id]: value }));
  const unitPrice = pricing.listPrice * (1 - buyer.discountPercent / 100);

  return (
    <aside aria-label="Price and booking" className="overflow-hidden rounded-2xl border border-line-soft bg-white shadow-[0_4px_12px_rgb(11_28_48/0.25)]">
      <div className="flex items-center justify-between bg-navy px-5 py-4 text-white sm:px-6">
        <p className="text-base font-semibold">{partner ? "Premium Partner price" : "List price"}</p>
        {partner ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold">
            <BadgeCheck className="size-3.5" aria-hidden />
            {buyer.discountPercent}% off
          </span>
        ) : null}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-2xl font-semibold tracking-tight text-navy">
            {formatCurrency(unitPrice)}
            {partner && buyer.discountPercent > 0 ? <span className="ml-2 text-base font-medium text-muted line-through">{formatCurrency(pricing.listPrice)}</span> : null}
          </p>
          <p className="text-sm text-muted">per {pricing.unitLabel}</p>
        </div>

        {pricing.perUnit ? (
          <div className="mt-5 flex items-center justify-between">
            <label htmlFor={`${baseId}-qty`} className="text-sm font-medium text-navy">
              Number of {pricing.unitLabelPlural}
            </label>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Fewer" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-md border border-line-soft text-navy">
                <Minus className="size-4" aria-hidden />
              </button>
              <input
                id={`${baseId}-qty`}
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
                className="h-8 w-14 rounded-md border border-line-soft text-center text-sm"
              />
              <button type="button" aria-label="More" onClick={() => setQuantity((value) => Math.min(1000, value + 1))} className="grid size-8 place-items-center rounded-md border border-line-soft text-navy">
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : null}

        <hr className="my-5 border-line-soft" />

        <ul className="grid gap-3 text-sm text-navy">
          <li className={cn("flex items-start gap-2", fastTrack && "text-muted")}>
            <Clock className="mt-0.5 size-[18px] shrink-0" aria-hidden />
            <span>
              <span className="font-medium">Standard:</span> {service.turnaround}
            </span>
          </li>
          {service.fastTrackTurnaround ? (
            <li className={cn("flex items-start gap-2", !fastTrack && "text-muted")}>
              <Zap className="mt-0.5 size-[18px] shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{partner ? "Your turnaround" : "Partner / Express"}:</span> {service.fastTrackTurnaround}
              </span>
            </li>
          ) : null}
          {pricing.siteVisit !== "NONE" ? <li className="text-xs text-muted">{pricing.siteVisit === "REQUIRED" ? "Includes a site visit (AM 8–12 or PM 12–6)." : "Site visit if needed."}</li> : null}
        </ul>

        {addOns.length ? (
          <>
            <hr className="my-5 border-line-soft" />
            <fieldset>
              <legend className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">Add-ons</legend>
              <ul className="mt-3 grid gap-3">
                {addOns.map((addOn) => {
                  const id = `${baseId}-${addOn.id}`;
                  const value = selected[addOn.id] ?? 0;
                  const label =
                    addOn.kind === "PERCENT_OF_LIST" ? `+${addOn.amount}%` : addOn.kind === "PER_MILE" ? `${formatCurrency(addOn.amount)}/mile over ${addOn.freeAllowance}` : `+${formatCurrency(addOn.amount)}`;
                  return (
                    <li key={addOn.id} className="flex items-center justify-between gap-3 text-sm text-navy">
                      {addOn.kind === "PER_MILE" || addOn.kind === "PER_UNIT" ? (
                        <label htmlFor={id} className="flex flex-1 items-center gap-3">
                          <input
                            id={id}
                            type="number"
                            min={0}
                            max={addOn.kind === "PER_MILE" ? 1000 : 10}
                            value={value || ""}
                            placeholder="0"
                            onChange={(event) => toggle(addOn.id, Math.max(0, Number(event.target.value) || 0))}
                            className="h-8 w-16 rounded-md border border-line-soft px-2 text-sm"
                            aria-describedby={`${id}-hint`}
                          />
                          <span>
                            {addOn.name}
                            <span id={`${id}-hint`} className="block text-xs text-muted">
                              {addOn.kind === "PER_MILE" ? "Total miles from base" : "Number of visits"}
                            </span>
                          </span>
                        </label>
                      ) : (
                        <label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-3">
                          <input id={id} type="checkbox" checked={value > 0} onChange={(event) => toggle(addOn.id, event.target.checked ? 1 : 0)} className="size-4 rounded border-line accent-brand" />
                          {addOn.name}
                        </label>
                      )}
                      <span className="font-bold whitespace-nowrap">{label}</span>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          </>
        ) : null}

        <hr className="my-5 border-line-soft" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Estimated total (excl. VAT)</span>
          <span className="text-lg font-semibold text-navy">{formatCurrency(estimate.netPence / 100)}</span>
        </div>

        <Link href={checkoutHref} className={buttonVariants({ size: "lg", fullWidth: true, className: "mt-6" })}>
          Start Project
          <ArrowRight aria-hidden />
        </Link>
        <p className="mt-5 text-center text-xs text-muted">
          Prices exclude VAT ({buyer.vatPercent}%), added at checkout.
          {!partner ? " Installers and agents with repeat work: Premium Partners get partner prices and fast-track turnaround." : null}
        </p>
      </div>
    </aside>
  );
}
