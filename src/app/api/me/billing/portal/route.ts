import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { billingPortal } from "@/server/services/billing";

/** → { url } to the Stripe customer portal (cards, invoices, cancel). */
export const POST = handle(async () => ok(await billingPortal(await requireUser())));
