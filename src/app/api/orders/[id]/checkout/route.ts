import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { checkout } from "@/server/services/orders";

/** → { url } — Stripe Checkout, or straight to the confirmation page in dev without Stripe. */
export const POST = handle<{ id: string }>(async (_request, { params }) => {
  const { id } = await params;
  return ok(await checkout(await requireUser(), id));
});
