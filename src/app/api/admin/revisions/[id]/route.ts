import { requireStaffUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { decideRevision, revisionDecisionSchema } from "@/server/services/projects";

/** Accept (billable rounds are invoiced) or decline an extra revision: { accept, pricePence? }. */
export const PATCH = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const user = await requireStaffUser();
  return ok(await decideRevision(user, id, await readJson(request, revisionDecisionSchema)));
});
