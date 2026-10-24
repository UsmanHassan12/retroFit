"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getServiceBySlug } from "@/features/services/queries";
import { getSession } from "@/lib/auth/session";

import { resolveSelection, totalsFor } from "./lib/order";
import { discountRateFor } from "./lib/pricing";

const placeOrderSchema = z.object({
  slug: z.string().min(1),
  tier: z.string().optional(),
  addons: z.string().optional(),
  discountCode: z.string().max(32).optional(),
});

export type PlaceOrderState = { error?: string };

/**
 * Creates the order. Prices are always recomputed on the server from the catalogue —
 * nothing price-related is trusted from the browser.
 * TODO: create a Stripe Checkout Session / PayPal order here and redirect to it.
 */
export async function placeOrder(_prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const parsed = placeOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Something went wrong with your order. Please try again." };

  const service = await getServiceBySlug(parsed.data.slug);
  if (!service) return { error: "This service is no longer available." };

  const selection = resolveSelection(service, parsed.data);
  const totals = totalsFor(selection, discountRateFor(parsed.data.discountCode));

  // Simulated order reference — the projects API returns the real one.
  const reference = `RET-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const params = new URLSearchParams({
    ref: reference,
    service: service.slug,
    total: totals.total.toFixed(2),
  });
  redirect(`/checkout/confirmation?${params.toString()}`);
}
