import { requireUser } from "@/server/auth/session";
import { handle, noContent, ok, readJson } from "@/server/http";
import { deleteProperty, propertyPatchSchema, updateProperty } from "@/server/services/account";

type Params = { id: string };

export const PATCH = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const user = await requireUser();
  return ok(await updateProperty(user, id, await readJson(request, propertyPatchSchema)));
});

export const DELETE = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  await deleteProperty(await requireUser(), id);
  return noContent();
});
