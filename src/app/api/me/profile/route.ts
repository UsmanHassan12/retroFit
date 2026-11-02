import { requireUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { getProfile, updateProfile, updateProfileSchema } from "@/server/services/account";

export const GET = handle(async () => ok(await getProfile(await requireUser())));

export const PATCH = handle(async (request) => {
  const user = await requireUser();
  return ok(await updateProfile(user, await readJson(request, updateProfileSchema)));
});
