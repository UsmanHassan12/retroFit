import { requireUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { cancelOrder, getOrder, updateOrder, updateOrderSchema } from "@/server/services/orders";

type Params = { id: string };

/** :id accepts the order id or its reference (ORD-2026-000123). */
export const GET = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  return ok(await getOrder(await requireUser(), id));
});

export const PATCH = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  return ok(await updateOrder(user, id, await readJson(request, updateOrderSchema)));
});

/** Cancels an unpaid order. */
export const DELETE = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  return ok(await cancelOrder(await requireUser(), id));
});
