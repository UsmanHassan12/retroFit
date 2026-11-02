/**
 * Display-side pricing maths for the receipt (pounds). The server recomputes every order in
 * pence (src/server/services/pricing.ts) — this mirror only keeps the UI responsive.
 * No imports, so it's safe to bundle on the client.
 */

export const VAT_RATE = 0.2;

export type OrderTotals = {
  base: number;
  addOns: number;
  discount: number;
  vat: number;
  total: number;
};

const round = (value: number) => Math.round(value * 100) / 100;

export function calculateTotals(input: { base: number; addOns: number[] }, discountRate = 0): OrderTotals {
  const addOns = input.addOns.reduce((sum, price) => sum + price, 0);
  const subtotal = input.base + addOns;
  const discount = round(subtotal * discountRate);
  const vat = round((subtotal - discount) * VAT_RATE);
  return { base: input.base, addOns, discount, vat, total: round(subtotal - discount + vat) };
}
