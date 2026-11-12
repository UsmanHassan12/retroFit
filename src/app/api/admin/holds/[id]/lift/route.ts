import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { adminLiftHold, liftHoldSchema } from "@/server/services/holds";

/** Lift a hold manually: { reason } (recorded). */
export const POST = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await adminLiftHold(admin.id, id, await readJson(request, liftHoldSchema)));
});
