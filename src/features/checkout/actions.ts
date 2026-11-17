"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCurrentUser, requireUser } from "@/server/auth/session";
import { PAYMENT_METHODS } from "@/server/domain";
import { messageFor } from "@/server/http";
import { listSlots } from "@/server/services/availability";
import { cancelOrder, checkDiscountCode, checkout, createOrder, payWithTestCard, quote, testCardSchema } from "@/server/services/orders";

import { parseAddons, parseQuantity } from "../services/selection";

const placeOrderSchema = z.object({
  slug: z.string().min(1),
  qty: z.string().optional(),
  addons: z.string().optional(),
  discountCode: z.string().max(32).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  propertyId: z.string().optional(),
  availabilityId: z.string().optional(),
});

export type PlaceOrderState = { error?: string; fields?: Record<string, string> };

/** Collect `prefix.key` form fields into an answers object (repeated keys become arrays). */
function answersFrom(formData: FormData, prefix: string) {
  const answers: Record<string, unknown> = {};
  for (const key of new Set([...formData.keys()].filter((name) => name.startsWith(`${prefix}.`)))) {
    const values = formData.getAll(key).map(String).filter((value) => value !== "");
    const name = key.slice(prefix.length + 1);
    if (name.endsWith("[]")) answers[name.slice(0, -2)] = values;
    else if (values.length) answers[name] = values[0];
  }
  return answers;
}

/**
 * "Complete Purchase": creates the order (priced on the server from the catalogue — nothing
 * price-related is trusted from the browser) and starts payment with the chosen method:
 * Stripe Checkout for cards, or straight to confirmation for credit / weekly invoice.
 */
export async function placeOrder(_prev: PlaceOrderState, formData: FormData): Promise<PlaceOrderState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = placeOrderSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([key]) => !key.includes("."))));
  if (!parsed.success) return { error: "Something went wrong with your order. Please try again." };
  const data = parsed.data;

  const newProperty =
    data.propertyId === "new" || !data.propertyId
      ? {
          line1: String(formData.get("property.line1") ?? ""),
          city: String(formData.get("property.city") ?? ""),
          postcode: String(formData.get("property.postcode") ?? ""),
          propertyType: String(formData.get("property.propertyType") ?? "house"),
        }
      : null;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  let url: string;
  try {
    const { order } = await createOrder(
      user,
      {
        lines: [
          {
            serviceId: data.slug,
            quantity: parseQuantity(data.qty),
            addons: parseAddons(data.addons),
            answers: answersFrom(formData, "line"),
            ...(newProperty && newProperty.line1 ? { property: newProperty } : data.propertyId && data.propertyId !== "new" ? { propertyId: data.propertyId } : {}),
            ...(data.availabilityId ? { availabilityId: data.availabilityId } : {}),
          },
        ],
        answers: answersFrom(formData, "order"),
        discountCode: data.discountCode || undefined,
        consent: {
          acceptTerms: formData.get("acceptTerms") === "on" ? true : (false as unknown as true),
          gdprConsent: formData.get("gdprConsent") === "on",
          shareDataConsent: formData.get("shareDataConsent") === "on",
        },
      },
      { ip },
    );
    ({ url } = await checkout(user, order.id, { method: data.method }));
  } catch (error) {
    return { error: messageFor(error, "We couldn’t start your payment. Please try again.") };
  }
  redirect(url);
}

export type TestPaymentState = { error?: string; fields?: Record<string, string> };

/** Test card page "Pay": confirms the order and creates its project(s). */
export async function payTestOrder(_prev: TestPaymentState, formData: FormData): Promise<TestPaymentState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const reference = String(formData.get("order") ?? "");
  const card = {
    cardName: String(formData.get("cardName") ?? ""),
    cardNumber: String(formData.get("cardNumber") ?? ""),
    expiry: String(formData.get("expiry") ?? ""),
    cvc: String(formData.get("cvc") ?? ""),
  };
  const parsed = testCardSchema.safeParse(card);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { error: "Please check the card details.", fields };
  }

  let url: string;
  try {
    ({ url } = await payWithTestCard(user, reference, card));
  } catch (error) {
    return { error: messageFor(error, "The test payment didn’t go through. Please try again.") };
  }
  redirect(url);
}

/** Test card page "Cancel": cancels the unpaid order (returning any held credit) and goes back. */
export async function cancelTestOrder(formData: FormData) {
  const user = await requireUser();
  const reference = String(formData.get("order") ?? "");
  const back = String(formData.get("back") ?? "/services");
  try {
    await cancelOrder(user, reference);
  } catch {
    // Already paid or cancelled: just go back.
  }
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/services");
}

/** Receipt "Apply": re-price with the code. Returns the new totals, or null when the code isn't valid. */
export async function applyDiscountCode(input: { slug: string; qty?: string; addons?: string; code: string }) {
  const user = await requireUser();
  const code = input.code.trim().toUpperCase();
  if (!code || code.length > 32 || !(await checkDiscountCode(code))) return null;
  const priced = await quote(user, {
    lines: [{ serviceId: input.slug, quantity: parseQuantity(input.qty), addons: parseAddons(input.addons), answers: {} }],
    answers: {},
    discountCode: code,
  });
  return { code, applied: priced.discountSource === "CODE", totals: priced.totals };
}

/** Visit slots for a postcode (when the customer picks another property). */
export async function slotsForPostcode(postcode: string) {
  await requireUser();
  try {
    return await listSlots({ postcode });
  } catch {
    return [];
  }
}
