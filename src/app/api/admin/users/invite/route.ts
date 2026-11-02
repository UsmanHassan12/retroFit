import { requireAdminUser } from "@/server/auth/session";
import { created, handle, readJson } from "@/server/http";
import { inviteSchema, inviteUser } from "@/server/services/admin";

export const POST = handle(async (request) => {
  const admin = await requireAdminUser();
  return created(await inviteUser(admin, await readJson(request, inviteSchema)));
});
