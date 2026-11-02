import { created, handle, readJson } from "@/server/http";
import { me, register, registerSchema } from "@/server/services/auth";

export const POST = handle(async (request) => {
  await register(await readJson(request, registerSchema));
  return created(await me());
});
