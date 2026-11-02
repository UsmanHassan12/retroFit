import { requireStaffUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { adminDashboard } from "@/server/services/admin";

/** Revenue figures are only included for admins. */
export const GET = handle(async () => ok(await adminDashboard(await requireStaffUser())));
