import type { AddonKind } from "../domain";

/**
 * Authoritative pricing, in integer pence. Pure functions: no database, no clock.
 *
 * Per line (catalogue doc → "Price calculation stays server-side"):
 *   list      = unit price × quantity            (or the bundle share of a bundle price)
 *   discount  = list × discount%                 (partner discount or code, never both)
 *   add-ons   = Express %, extra visits, travel  (not discounted)
 *   net       = list − discount + add-ons
 *   VAT       = net × VAT%
 *   total     = net + VAT
 * Every step rounds half-up to the nearest penny. Order totals are the sum of lines, so a
 * weekly invoice built from lines always adds up to the receipts.
 */

/** Basis points: 10000 = 100%. */
export const bpsOf = (amountPence: number, bps: number) => Math.round((amountPence * bps) / 10_000);
export const percentToBps = (percent: number) => Math.round(percent * 100);

export type AddonInput = {
  key: string;
  name: string;
  kind: AddonKind;
  /** Pence, or basis points for PERCENT_OF_LIST. */
  amount: number;
  /** PER_MILE: miles included before charging. */
  freeAllowance?: number;
  /** PER_UNIT: count; PER_MILE: total miles. Ignored for the other kinds. */
  quantity?: number;
};

export type PricedAddon = AddonInput & { quantity: number; totalPence: number };

export function priceAddon(addon: AddonInput, listPence: number): PricedAddon {
  const quantity = Math.max(0, Math.floor(addon.quantity ?? 1));
  let totalPence = 0;
  switch (addon.kind) {
    case "PERCENT_OF_LIST":
      totalPence = bpsOf(listPence, addon.amount);
      break;
    case "PER_UNIT":
      totalPence = addon.amount * quantity;
      break;
    case "PER_MILE":
      totalPence = addon.amount * Math.max(0, quantity - (addon.freeAllowance ?? 0));
      break;
    case "FIXED":
      totalPence = addon.amount;
      break;
  }
  return { ...addon, quantity, totalPence };
}

export type LineInput = {
  unitPricePence: number;
  quantity: number;
  /** Overrides unit × quantity (bundle share). */
  listPenceOverride?: number;
  discountBps: number;
  addons: AddonInput[];
  vatBps: number;
};

export type LinePrice = {
  unitPricePence: number;
  quantity: number;
  listPence: number;
  discountBps: number;
  discountPence: number;
  addons: PricedAddon[];
  addonsPence: number;
  netPence: number;
  vatPence: number;
  totalPence: number;
};

export function priceLine(input: LineInput): LinePrice {
  const quantity = Math.max(1, Math.floor(input.quantity));
  const listPence = input.listPenceOverride ?? input.unitPricePence * quantity;
  const discountBps = Math.min(10_000, Math.max(0, Math.round(input.discountBps)));
  const discountPence = bpsOf(listPence, discountBps);
  const addons = input.addons.map((addon) => priceAddon(addon, listPence));
  const addonsPence = addons.reduce((sum, addon) => sum + addon.totalPence, 0);
  const netPence = listPence - discountPence + addonsPence;
  const vatPence = bpsOf(netPence, input.vatBps);
  return {
    unitPricePence: input.unitPricePence,
    quantity,
    listPence,
    discountBps,
    discountPence,
    addons,
    addonsPence,
    netPence,
    vatPence,
    totalPence: netPence + vatPence,
  };
}

export type OrderTotals = {
  listPence: number;
  discountPence: number;
  addonsPence: number;
  netPence: number;
  vatPence: number;
  totalPence: number;
};

export function sumLines(lines: Array<Pick<LinePrice, "listPence" | "discountPence" | "addonsPence" | "netPence" | "vatPence" | "totalPence">>): OrderTotals {
  return lines.reduce<OrderTotals>(
    (sum, line) => ({
      listPence: sum.listPence + line.listPence,
      discountPence: sum.discountPence + line.discountPence,
      addonsPence: sum.addonsPence + line.addonsPence,
      netPence: sum.netPence + line.netPence,
      vatPence: sum.vatPence + line.vatPence,
      totalPence: sum.totalPence + line.totalPence,
    }),
    { listPence: 0, discountPence: 0, addonsPence: 0, netPence: 0, vatPence: 0, totalPence: 0 },
  );
}

/**
 * Which discount applies to a line. A partner discount and a discount code never stack:
 * the larger wins. Non-discountable services get nothing.
 */
export function chooseDiscount(input: { discountable: boolean; partnerBps?: number | null; codeBps?: number | null }) {
  if (!input.discountable) return { bps: 0, source: "NONE" as const };
  const partner = Math.max(0, input.partnerBps ?? 0);
  const code = Math.max(0, input.codeBps ?? 0);
  if (partner === 0 && code === 0) return { bps: 0, source: "NONE" as const };
  return partner >= code ? { bps: partner, source: "PARTNER" as const } : { bps: code, source: "CODE" as const };
}

/** Partner discount for one service: the per-service override wins, clamped to the allowed range. */
export function partnerDiscountBps(input: { defaultBps: number; overrideBps?: number | null; minBps: number; maxBps: number }) {
  const value = input.overrideBps ?? input.defaultBps;
  return Math.min(input.maxBps, Math.max(input.minBps, value));
}

/**
 * Split a bundle price across its services in proportion to their list prices, so each
 * project carries a fair share. The last item absorbs the rounding remainder.
 */
export function allocateBundle(bundlePence: number, listPrices: number[]) {
  const total = listPrices.reduce((sum, value) => sum + value, 0);
  if (listPrices.length === 0) return [];
  if (total === 0) {
    const even = Math.floor(bundlePence / listPrices.length);
    return listPrices.map((_, index) => (index === listPrices.length - 1 ? bundlePence - even * (listPrices.length - 1) : even));
  }
  let allocated = 0;
  return listPrices.map((price, index) => {
    if (index === listPrices.length - 1) return bundlePence - allocated;
    const share = Math.round((bundlePence * price) / total);
    allocated += share;
    return share;
  });
}

export const formatPence = (pence: number) =>
  `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
