"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, requireUser } from "@/server/auth/session";
import { messageFor } from "@/server/http";
import { checkDiscountCode, checkout, createOrder } from "@/server/services/orders";

const placeOrderSchema = z.object({
  slug: z.string().min(1),
  tier: z.string().min(1),
  addons: z.string().optional(),
  discountCode: z.string().max(32).optional(),
});

export type PlaceOrderState = { error?: string };

/**
 * Creates the order and starts payment. Prices are recomputed on the server from the catalogue
 * (nothing price-related is trusted from the browser), then the browser is sent to Stripe
 * Checkout — or, in development without Stripe, straight to the confirmation page.
 */
export async function placeOrder(_prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = placeOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Something went wrong with your order. Please try again." };

  let url: string;
  try {
    const order = await createOrder(user, {
      serviceId: parsed.data.slug,
      tierId: parsed.data.tier,
      addonIds: (parsed.data.addons ?? "").split(",").filter(Boolean),
      discountCode: parsed.data.discountCode || undefined,
    });
    ({ url } = await checkout(user, order.id));
  } catch (error) {
    return { error: messageFor(error, "We couldn’t start your payment. Please try again.") };
  }
  redirect(url);
}

/** Receipt "Apply" button. Returns the percentage, or null when the code isn't valid. */
export async function applyDiscountCode(code: string): Promise<{ code: string; percentOff: number } | null> {
  await requireUser();
  if (!code.trim() || code.length > 32) return null;
  return checkDiscountCode(code);
}
