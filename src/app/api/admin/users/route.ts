import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readQuery } from "@/server/http";
import { listUsers } from "@/server/services/admin";

/** ?role=COORDINATOR,ADMIN&status=ACTIVE&q=&staffOnly=true */
export const GET = handle(async (request) => {
  await requireAdminUser();
  return ok(await listUsers(readQuery(request)));
});
