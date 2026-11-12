import { requireStaffUser } from "@/server/auth/session";
import { handle, ok, readOptionalJson } from "@/server/http";
import { advanceStage, advanceStageSchema } from "@/server/services/projects";

/** Move to the next stage, or { position } to a given one. Stages can move the project status. */
export const POST = handle<{ ref: string }>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireStaffUser();
  return ok(await advanceStage(user, ref, await readOptionalJson(request, advanceStageSchema)));
});
