import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { payInvoice } from "@/server/services/billing";

/** → { url } to pay an open invoice by card. */
export const POST = handle<{ id: string }>(async (_request, { params }) => {
  const { id } = await params;
  return ok(await payInvoice(await requireUser(), id));
});
