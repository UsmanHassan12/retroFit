import { requireUser } from "@/server/auth/session";
import { clientIp, created, handle, ok, readJson } from "@/server/http";
import { createOrder, createOrderSchema, listOrders } from "@/server/services/orders";

export const GET = handle(async () => ok({ orders: await listOrders(await requireUser()) }));

/**
 * Creates a DRAFT order priced on the server. Body: { lines[], bundleId?, answers, discountCode?, consent }.
 * Returns { order, missing, paymentMethods } — `missing` lists intake answers still needed.
 */
export const POST = handle(async (request) => {
  const user = await requireUser();
  return created(await createOrder(user, await readJson(request, createOrderSchema), { ip: clientIp(request) }));
});
