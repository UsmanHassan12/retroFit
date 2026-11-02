import { unauthenticated } from "@/server/errors";
import { handle, ok } from "@/server/http";
import { me } from "@/server/services/auth";

export const GET = handle(async () => {
  const result = await me();
  if (!result) throw unauthenticated();
  return ok(result);
});
