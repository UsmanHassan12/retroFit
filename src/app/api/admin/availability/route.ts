import { requireStaffUser } from "@/server/auth/session";
import { forbidden } from "@/server/errors";
import { created, handle, ok, readJson, readQuery } from "@/server/http";
import { availabilityCreateSchema, createAvailability, listAvailability } from "@/server/services/availability";

/** ?assessorId=&region=&from=&to= */
export const GET = handle(async (request) => {
  await requireStaffUser();
  return ok({ slots: await listAvailability(readQuery(request)) });
});

/** Publish capacity: { assessorId, region, from, to, weekdays?, windows?, capacity? }. Admins and coordinators. */
export const POST = handle(async (request) => {
  const user = await requireStaffUser();
  if (user.role !== "ADMIN" && user.role !== "COORDINATOR") throw forbidden();
  return created(await createAvailability(user.id, await readJson(request, availabilityCreateSchema)));
});
