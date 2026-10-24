import { isTierId } from "@/features/services/queries";
import type { Service, ServiceAddOn, ServiceTier } from "@/features/services/types";

import { calculateTotals, type OrderTotals } from "./pricing";

export type OrderSelection = {
  service: Service;
  tier: ServiceTier;
  addOns: ServiceAddOn[];
};

/** Resolve ?tier=&addons= into a validated selection. Unknown ids are ignored, never trusted. */
export function resolveSelection(service: Service, params: { tier?: string; addons?: string }): OrderSelection {
  const tierId = isTierId(params.tier) ? params.tier : "basic";
  const tier = service.tiers.find((item) => item.id === tierId) ?? service.tiers[0]!;
  const requested = new Set((params.addons ?? "").split(",").filter(Boolean));
  const addOns = service.addOns.filter((addOn) => requested.has(addOn.id));
  return { service, tier, addOns };
}

export function totalsFor(selection: OrderSelection, discountRate = 0): OrderTotals {
  return calculateTotals(
    { base: selection.tier.price, addOns: selection.addOns.map((addOn) => addOn.price) },
    discountRate,
  );
}

export function selectionQuery(selection: OrderSelection) {
  const params = new URLSearchParams({ tier: selection.tier.id });
  if (selection.addOns.length) params.set("addons", selection.addOns.map((addOn) => addOn.id).join(","));
  return params.toString();
}
