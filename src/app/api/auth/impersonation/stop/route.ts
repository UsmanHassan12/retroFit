import { handle, ok } from "@/server/http";
import { me, stopImpersonation } from "@/server/services/auth";

export const POST = handle(async () => {
  await stopImpersonation();
  return ok(await me());
});
