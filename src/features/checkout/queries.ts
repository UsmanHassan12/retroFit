import "server-only";

import type { AuthUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { listSlots } from "@/server/services/availability";
import { getIntakeForm } from "@/server/services/intake";
import { quote } from "@/server/services/orders";

import type { OrderSelection } from "./lib/order";

/** Server-priced quote for the checkout pages (pence). */
export async function quoteSelection(user: Pick<AuthUser, "id"> | null, selection: OrderSelection, discountCode?: string | null) {
  return quote(user, {
    lines: [{ serviceId: selection.service.slug, quantity: selection.quantity, addons: selection.addons, answers: {} }],
    answers: {},
    discountCode: discountCode || undefined,
  });
}
export type CheckoutQuote = Awaited<ReturnType<typeof quoteSelection>>;

/** Everything the "Complete your order" step needs besides the price. */
export async function getCheckoutContext(user: AuthUser, selection: OrderSelection) {
  const [properties, intake, profile] = await Promise.all([
    db.property.findMany({ where: { ownerId: user.id }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { id: true, line1: true, city: true, postcode: true } }),
    getIntakeForm({ services: [selection.service.slug] }),
    db.user.findUnique({ where: { id: user.id }, select: { customerType: true } }),
  ]);
  const needsVisit = selection.service.pricing.siteVisit === "REQUIRED";
  const first = properties[0];
  const slots = needsVisit && first ? await listSlots({ postcode: first.postcode }).catch(() => []) : [];
  return {
    properties: properties.map((property: { id: string; line1: string; city: string; postcode: string }) => ({ ...property, label: `${property.line1}, ${property.city} ${property.postcode}` })),
    needsVisit,
    slots,
    intake,
    facts: { $tier: user.tier, $services: [selection.service.code], $customerType: (profile?.customerType as string | null) ?? null },
  };
}
export type CheckoutContext = Awaited<ReturnType<typeof getCheckoutContext>>;
