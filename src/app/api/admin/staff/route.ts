import { requireStaffUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { listStaff } from "@/server/services/projects";

/** Active staff for assignment pickers. */
export const GET = handle(async () => {
  await requireStaffUser();
  return ok({ staff: await listStaff() });
});
