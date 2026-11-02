import { handle, ok, readJson } from "@/server/http";
import { login, loginSchema, me } from "@/server/services/auth";

export const POST = handle(async (request) => {
  await login(await readJson(request, loginSchema));
  return ok(await me());
});
