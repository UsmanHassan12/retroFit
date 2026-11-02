import { requireUser } from "@/server/auth/session";
import { handle, ok, readQuery } from "@/server/http";
import { listProjects } from "@/server/services/projects";

/** GET /api/projects?status=all|active|completed&q= */
export const GET = handle(async (request) => {
  const user = await requireUser();
  return ok({ projects: await listProjects(user, readQuery(request)) });
});
