import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { subscribe } from "@/server/services/billing";

const schema = z.object({ plan: z.literal("PRIORITY") });

/** → { url } to Stripe Checkout (subscription mode). */
export const POST = handle(async (request) => {
  const user = await requireUser();
  const { plan } = await readJson(request, schema);
  return ok(await subscribe(user, plan));
});
