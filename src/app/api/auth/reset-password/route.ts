import { handle, ok, readJson } from "@/server/http";
import { me, resetPassword, resetPasswordSchema } from "@/server/services/auth";

export const POST = handle(async (request) => {
  await resetPassword(await readJson(request, resetPasswordSchema));
  return ok(await me());
});
