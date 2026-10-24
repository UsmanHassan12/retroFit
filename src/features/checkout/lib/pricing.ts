/**
 * Pure pricing maths shared by the server (authoritative) and the receipt UI (display).
 * No imports, so it's safe to bundle on the client.
 */

export const VAT_RATE = 0.2;

/** Demo discount codes. Real codes are validated by the payments API. */
export const DISCOUNT_CODES: Record<string, number> = {
  RETRO2026: 0.1,
  WELCOME5: 0.05,
};

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

export function discountRateFor(code: string | undefined | null) {
  if (!code) return 0;
  return DISCOUNT_CODES[code.trim().toUpperCase()] ?? 0;
}
