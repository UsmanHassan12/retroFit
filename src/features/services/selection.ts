/**
 * The basket for one service travels in the URL: ?qty=4&addons=express,extra-visit:2,travel:40
 * (quantity for per-element / junction / visit services; add-on quantities after a colon).
 * Client-safe: no imports. The server re-validates everything when it prices the order.
 */

export type AddonSelection = { key: string; quantity: number };

export function parseAddons(value: string | undefined | null): AddonSelection[] {
  const seen = new Set<string>();
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const [key = "", raw] = part.split(":");
      const quantity = raw === undefined ? 1 : Math.max(0, Math.min(10_000, Math.floor(Number(raw) || 0)));
      if (!/^[a-z0-9-]{1,40}$/.test(key) || quantity === 0 || seen.has(key)) return [];
      seen.add(key);
      return [{ key, quantity }];
    });
}

export function addonQuery(selected: Record<string, number> | AddonSelection[]) {
  const entries = Array.isArray(selected) ? selected.map((item) => [item.key, item.quantity] as const) : Object.entries(selected);
  return entries
    .filter(([, quantity]) => quantity > 0)
    .map(([key, quantity]) => (quantity === 1 ? key : `${key}:${quantity}`))
    .join(",");
}

export function parseQuantity(value: string | undefined | null) {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) && quantity >= 1 ? Math.min(quantity, 1_000) : 1;
}
