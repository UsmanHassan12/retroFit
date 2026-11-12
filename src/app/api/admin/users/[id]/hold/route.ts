import { requireAdminUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { adminPlaceHold, listHolds, placeHoldSchema } from "@/server/services/holds";

type Params = { id: string };

export const GET = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  await requireAdminUser();
  return ok({ holds: await listHolds(id) });
});

/** Place a manual hold: { reason }. */
export const POST = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return created(await adminPlaceHold(admin.id, id, await readJson(request, placeHoldSchema)));
});
