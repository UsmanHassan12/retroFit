import { requireUser } from "@/server/auth/session";
import { created, handle, readJson } from "@/server/http";
import { applyForPartnership, applySchema } from "@/server/services/partners";

export const POST = handle(async (request) => {
  const user = await requireUser();
  return created(await applyForPartnership(user, await readJson(request, applySchema)));
});
