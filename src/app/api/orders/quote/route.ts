import { z } from "zod";

import { getCurrentUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { quote } from "@/server/services/orders";

const schema = z.object({
  serviceId: z.string().min(1),
  tierId: z.string().min(1),
  addonIds: z.array(z.string()).default([]),
  discountCode: z.string().trim().max(32).nullable().optional(),
});

/** Price preview without creating an order (used by the receipt). */
export const POST = handle(async (request) => {
  const input = await readJson(request, schema);
  return ok(await quote(await getCurrentUser(), input));
});
