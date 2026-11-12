import { requireUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { intakeUpdateSchema, updateIntake } from "@/server/services/projects";

/** Complete missing answers: { orderAnswers?, answers? }. */
export const PUT = handle<{ ref: string }>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireUser();
  return ok(await updateIntake(user, ref, await readJson(request, intakeUpdateSchema)));
});
