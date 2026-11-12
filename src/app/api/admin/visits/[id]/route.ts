import { requireStaffUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { recordVisitOutcome, visitOutcomeSchema } from "@/server/services/availability";

/** Record the outcome: { status: COMPLETED | NO_ACCESS | CANCELLED, notes? }. */
export const PATCH = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const user = await requireStaffUser();
  return ok({ visits: await recordVisitOutcome(user, id, await readJson(request, visitOutcomeSchema)) });
});
