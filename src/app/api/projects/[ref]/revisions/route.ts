import { requireUser } from "@/server/auth/session";
import { created, handle, readJson } from "@/server/http";
import { requestRevision, revisionSchema } from "@/server/services/projects";

/** Ask for a revision on a delivered project: { note }. */
export const POST = handle<{ ref: string }>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireUser();
  return created(await requestRevision(user, ref, await readJson(request, revisionSchema)));
});
