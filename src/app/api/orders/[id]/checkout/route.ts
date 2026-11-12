import { requireUser } from "@/server/auth/session";
import { handle, ok, readOptionalJson } from "@/server/http";
import { checkout, checkoutSchema } from "@/server/services/orders";

/**
 * Body: { method?: CARD | CREDIT | CREDIT_AND_CARD | WEEKLY_INVOICE } (defaults to the first allowed).
 * → { url, paid } — Stripe Checkout, or the confirmation page when confirmed straight away.
 */
export const POST = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  return ok(await checkout(user, id, await readOptionalJson(request, checkoutSchema)));
});
