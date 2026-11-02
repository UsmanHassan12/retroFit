import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { getUser, updateUser, updateUserSchema } from "@/server/services/admin";

type Params = { id: string };

export const GET = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  await requireAdminUser();
  return ok(await getUser(id));
});

export const PATCH = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await updateUser(admin, id, await readJson(request, updateUserSchema)));
});
