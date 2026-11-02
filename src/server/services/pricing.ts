import { PRIORITY_PLAN_DISCOUNT_PERCENT, VAT_RATE_PERCENT, type Plan } from "../domain";

/**
 * Authoritative order pricing, in integer pence.
 *   subtotal = base + add-ons
 *   discount = max(code %, Priority-plan 15%) of subtotal   (they never stack)
 *   VAT      = 20% of (subtotal − discount)
 *   total    = subtotal − discount + VAT
 * Each step rounds half-up to the nearest penny.
 */

export type PriceBreakdown = {
  basePence: number;
  addonsPence: number;
  subtotalPence: number;
  discountPence: number;
  discountPercent: number;
  discountSource: "NONE" | "CODE" | "PLAN";
  vatPence: number;
  totalPence: number;
};

const percentOf = (amount: number, percent: number) => Math.round((amount * percent) / 100);

export function priceOrder(input: {
  basePence: number;
  addonPence: number[];
  codePercent?: number | null;
  plan?: Plan | null;
}): PriceBreakdown {
  const addonsPence = input.addonPence.reduce((sum, value) => sum + value, 0);
  const subtotalPence = input.basePence + addonsPence;

  const codePercent = input.codePercent ?? 0;
  const planPercent = input.plan === "PRIORITY" || input.plan === "ENTERPRISE" ? PRIORITY_PLAN_DISCOUNT_PERCENT : 0;
  const discountPercent = Math.max(codePercent, planPercent);
  const discountSource = discountPercent === 0 ? "NONE" : codePercent >= planPercent ? "CODE" : "PLAN";

  const discountPence = percentOf(subtotalPence, discountPercent);
  const vatPence = percentOf(subtotalPence - discountPence, VAT_RATE_PERCENT);

  return {
    basePence: input.basePence,
    addonsPence,
    subtotalPence,
    discountPence,
    discountPercent,
    discountSource,
    vatPence,
    totalPence: subtotalPence - discountPence + vatPence,
  };
}

export const penceToPounds = (pence: number) => pence / 100;
export const poundsToPence = (pounds: number) => Math.round(pounds * 100);
