"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/session";
import { messageFor } from "@/server/http";
import { billingPortal, subscribe } from "@/server/services/billing";

export type BillingActionState = { message?: string };

/** Billing buttons: `intent` = "subscribe" (Priority checkout) or "portal" (Stripe customer portal). */
export async function billingAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  let url: string;
  try {
    const user = await requireUser();
    const intent = formData.get("intent");
    url = intent === "subscribe" ? (await subscribe(user, "PRIORITY")).url : (await billingPortal(user)).url;
  } catch (error) {
    return { message: messageFor(error) };
  }
  redirect(url);
}
