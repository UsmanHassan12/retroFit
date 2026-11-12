import { getCurrentUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { quote, quoteSchema } from "@/server/services/orders";

/** Price preview without saving. Works signed out (Basic prices); partners see their discount. */
export const POST = handle(async (request) => {
  const input = await readJson(request, quoteSchema);
  return ok(await quote(await getCurrentUser(), input));
});
