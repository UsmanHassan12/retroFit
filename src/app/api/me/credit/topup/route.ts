import { requireUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { startTopup, topupSchema } from "@/server/services/credit";

/** Body { amountPence } → { url } to Stripe Checkout (or credited at once in dev). */
export const POST = handle(async (request) => {
  const user = await requireUser();
  return ok(await startTopup(user, await readJson(request, topupSchema)));
});
