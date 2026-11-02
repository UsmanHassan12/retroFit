import "server-only";

import Stripe from "stripe";

import { env } from "../env";
import { badRequest, notConfigured } from "../errors";

/** Lazily-created Stripe client; null when STRIPE_SECRET_KEY isn't set. */
let client: Stripe | null | undefined;

export function stripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = env().STRIPE_SECRET_KEY;
  client = key ? new Stripe(key, { appInfo: { name: "Retrofit Portal" } }) : null;
  return client;
}

export function requireStripe(): Stripe {
  const instance = stripe();
  if (!instance) throw notConfigured("Payments are not configured. Set STRIPE_SECRET_KEY.");
  return instance;
}

/** Verify a webhook payload against STRIPE_WEBHOOK_SECRET. */
export async function constructWebhookEvent(payload: string, signature: string | null) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) throw notConfigured("STRIPE_WEBHOOK_SECRET is not set.");
  if (!signature) throw badRequest("Missing Stripe-Signature header.");
  return requireStripe().webhooks.constructEventAsync(payload, signature, secret);
}

export type { Stripe };
