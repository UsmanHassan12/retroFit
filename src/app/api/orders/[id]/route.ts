import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { cancelOrder, getOrder } from "@/server/services/orders";

type Params = { id: string };

/** :id accepts the order id or its reference (ORD-2026-000123). */
export const GET = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  return ok(await getOrder(await requireUser(), id));
});

/** Cancels an unpaid order (booked services are cancelled per project: POST /api/projects/:ref/cancel). */
export const DELETE = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  return ok(await cancelOrder(await requireUser(), id));
});
