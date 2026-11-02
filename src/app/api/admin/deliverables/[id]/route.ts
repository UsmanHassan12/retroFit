import { requireStaffUser } from "@/server/auth/session";
import { handle, noContent, ok, readJson } from "@/server/http";
import { deleteDeliverable, deliverablePatchSchema, updateDeliverable } from "@/server/services/deliverables";

type Params = { id: string };

export const PATCH = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const user = await requireStaffUser();
  return ok(await updateDeliverable(user, id, await readJson(request, deliverablePatchSchema)));
});

export const DELETE = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  await deleteDeliverable(await requireStaffUser(), id);
  return noContent();
});
