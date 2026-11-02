import { constructWebhookEvent } from "@/server/integrations/stripe";
import { handle, ok } from "@/server/http";
import { handleStripeEvent } from "@/server/services/billing";

export const dynamic = "force-dynamic";

/** Stripe → us. The raw body is needed for signature verification. */
export const POST = handle(async (request) => {
  const event = await constructWebhookEvent(await request.text(), request.headers.get("stripe-signature")).catch((error) => {
    console.error("[stripe] webhook signature check failed", error);
    throw error;
  });
  await handleStripeEvent(event);
  return ok({ received: true });
});
