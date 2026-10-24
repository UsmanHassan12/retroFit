const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const gbpWhole = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const gbpCompact = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** £1,450.00 */
export const formatCurrency = (amount: number) => gbp.format(amount);

/** £1,450 */
export const formatPrice = (amount: number) => gbpWhole.format(amount);

/** £5.5K */
export const formatCompactCurrency = (amount: number) => gbpCompact.format(amount);

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** 18 May 2026 */
export const formatDate = (value: string | Date) =>
  dateFormatter.format(typeof value === "string" ? new Date(value) : value);
