import { addonQuery, parseAddons, parseQuantity, type AddonSelection } from "@/features/services/selection";
import type { Service } from "@/features/services/types";

/** What the customer picked on the service page (carried in the URL between checkout steps). */
export type OrderSelection = {
  service: Service;
  quantity: number;
  addons: AddonSelection[];
};

/** Resolve ?qty=&addons= into a selection. Unknown add-ons are dropped here and rejected again by the server. */
export function resolveSelection(service: Service, params: { qty?: string; addons?: string }): OrderSelection {
  const known = new Set(service.addOns.map((addOn) => addOn.id));
  return {
    service,
    quantity: service.pricing.perUnit ? parseQuantity(params.qty) : 1,
    addons: parseAddons(params.addons).filter((addon) => known.has(addon.key)),
  };
}

export function selectionQuery(selection: OrderSelection) {
  const params = new URLSearchParams();
  if (selection.quantity > 1) params.set("qty", String(selection.quantity));
  const addons = addonQuery(selection.addons);
  if (addons) params.set("addons", addons);
  return params.toString();
}
