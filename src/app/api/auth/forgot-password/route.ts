import { handle, ok, readJson } from "@/server/http";
import { forgotPassword, forgotPasswordSchema } from "@/server/services/auth";

/** Always 200 so it can't be used to find out which emails have accounts. */
export const POST = handle(async (request) => {
  await forgotPassword(await readJson(request, forgotPasswordSchema));
  return ok({ message: "If an account exists for that email, we've sent a reset link." });
});
