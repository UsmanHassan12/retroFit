import { requireAdminUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { listHolds } from "@/server/services/holds";

/** Accounts currently on hold. */
export const GET = handle(async () => {
  await requireAdminUser();
  return ok({ holds: await listHolds() });
});
