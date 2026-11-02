import { requireStaffUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { getProject, updateProject, updateProjectSchema } from "@/server/services/projects";

type Params = { ref: string };

export const GET = handle<Params>(async (_request, { params }) => {
  const { ref } = await params;
  return ok(await getProject(await requireStaffUser(), ref));
});

/** Phase changes update milestones and email the client. Team changes need COORDINATOR or ADMIN. */
export const PATCH = handle<Params>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireStaffUser();
  return ok(await updateProject(user, ref, await readJson(request, updateProjectSchema)));
});
