import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { getProject } from "@/server/services/projects";

export const GET = handle<{ ref: string }>(async (_request, { params }) => {
  const { ref } = await params;
  return ok(await getProject(await requireUser(), ref));
});
