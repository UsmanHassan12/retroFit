import { requireUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { createOrder, createOrderSchema, listOrders } from "@/server/services/orders";

export const GET = handle(async () => ok({ orders: await listOrders(await requireUser()) }));

/** Creates a DRAFT order with a server-computed price breakdown. */
export const POST = handle(async (request) => {
  const user = await requireUser();
  return created(await createOrder(user, await readJson(request, createOrderSchema)));
});
