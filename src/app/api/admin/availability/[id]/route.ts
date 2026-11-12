import { requireStaffUser } from "@/server/auth/session";
import { forbidden } from "@/server/errors";
import { handle, noContent, readJson } from "@/server/http";
import { availabilityPatchSchema, deleteAvailability, updateAvailability } from "@/server/services/availability";

type Params = { id: string };

async function manager() {
  const user = await requireStaffUser();
  if (user.role !== "ADMIN" && user.role !== "COORDINATOR") throw forbidden();
  return user;
}

export const PATCH = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const user = await manager();
  await updateAvailability(user.id, id, await readJson(request, availabilityPatchSchema));
  return noContent();
});

export const DELETE = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  const user = await manager();
  await deleteAvailability(user.id, id);
  return noContent();
});
