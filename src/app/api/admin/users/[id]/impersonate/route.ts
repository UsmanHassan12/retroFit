import { requireAdminUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { impersonate, me } from "@/server/services/auth";

/** Signs in as the user for up to 1 hour. POST /api/auth/impersonation/stop to return. */
export const POST = handle<{ id: string }>(async (_request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  await impersonate(admin.id, id);
  return ok(await me());
});
