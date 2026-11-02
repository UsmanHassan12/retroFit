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

/** Times are always shown in UK time so server and browser render identically. */
const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/London" });

/** 14:22 */
export const formatTime = (value: string | Date) => timeFormatter.format(typeof value === "string" ? new Date(value) : value);

/** 12/05/2026 */
export const formatShortDate = (value: string | Date) => shortDate.format(typeof value === "string" ? new Date(value) : value);

/** "Just now", "5m ago", "2h ago", "Yesterday", "3d ago", then a date. */
export function formatRelative(value: string | Date, now = Date.now()) {
  const date = typeof value === "string" ? new Date(value) : value;
  const minutes = Math.round((now - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

/** Pence → pounds for display helpers that take pounds. */
export const fromPence = (pence: number) => pence / 100;
