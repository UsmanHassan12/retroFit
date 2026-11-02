import { requireStaffUser } from "@/server/auth/session";
import { handle, ok, readQuery } from "@/server/http";
import { adminDirectory } from "@/server/services/projects";

/** ?status=&assignedTo=&from=&to=&hasIssues=&criticalOnly=&q=&page= */
export const GET = handle(async (request) => {
  const user = await requireStaffUser();
  return ok(await adminDirectory(user, readQuery(request)));
});
