import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { getRequirements } from "@/server/services/projects";

/** Intake answers and documents still needed before work can start. */
export const GET = handle<{ ref: string }>(async (_request, { params }) => {
  const { ref } = await params;
  return ok(await getRequirements(await requireUser(), ref));
});
