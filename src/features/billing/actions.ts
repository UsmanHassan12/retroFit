"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/server/auth/session";
import { messageFor } from "@/server/http";
import { billingPortal, payInvoice } from "@/server/services/billing";
import { startTopup } from "@/server/services/credit";
import { applyForPartnership, cancelSubscription, signAgreement, startSubscription } from "@/server/services/partners";

export type BillingActionState = { message?: string; ok?: boolean };

/**
 * Billing buttons. `intent`:
 *   portal      Stripe customer portal (cards)
 *   subscribe   start the Premium Partner subscription
 *   cancel      give notice on the partner subscription
 *   topup       add account credit (field: amount, in pounds)
 *   pay         pay an open invoice by card (field: invoiceId)
 */
export async function billingAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  let url: string | null = null;
  try {
    const user = await requireUser();
    const intent = String(formData.get("intent"));
    if (intent === "subscribe") url = (await startSubscription(user)).url;
    else if (intent === "cancel") {
      const { endsAt } = await cancelSubscription(user);
      revalidatePath("/dashboard/billing");
      return { ok: true, message: `Notice received. Your partnership ends on ${new Date(endsAt).toLocaleDateString("en-GB")}.` };
    } else if (intent === "topup") url = (await startTopup(user, { amountPence: Math.round(Number(formData.get("amount")) * 100) })).url;
    else if (intent === "pay") url = (await payInvoice(user, String(formData.get("invoiceId")))).url;
    else url = (await billingPortal(user)).url;
  } catch (error) {
    return { message: messageFor(error) };
  }
  if (!url) return {};
  redirect(url);
}

/** Partner application and e-signature forms. */
export async function partnerAction(_prev: BillingActionState, formData: FormData): Promise<BillingActionState> {
  try {
    const user = await requireUser();
    if (formData.get("intent") === "sign") {
      const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      await signAgreement(user, { fullName: String(formData.get("fullName") ?? ""), accept: formData.get("accept") === "on" ? true : (false as unknown as true), version: String(formData.get("version") ?? "") }, { ip });
    } else {
      await applyForPartnership(user, {
        companyName: String(formData.get("companyName") ?? ""),
        trustmarkLicence: String(formData.get("trustmarkLicence") ?? "") || undefined,
        vatNumber: String(formData.get("vatNumber") ?? "") || undefined,
        customerType: (String(formData.get("customerType") ?? "") || "INSTALLER") as never,
        note: String(formData.get("note") ?? "") || undefined,
      });
    }
  } catch (error) {
    return { message: messageFor(error) };
  }
  revalidatePath("/dashboard/billing/plans");
  revalidatePath("/dashboard/billing");
  return { ok: true };
}
