import { requireStaffUser } from "@/server/auth/session";
import { created, handle, readJson } from "@/server/http";
import { addDeliverableVersion, versionSchema } from "@/server/services/deliverables";

/** Issue a version: { documentId, label?: INITIAL | REVISED | FINAL, note? }. */
export const POST = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const user = await requireStaffUser();
  return created(await addDeliverableVersion(user, id, await readJson(request, versionSchema)));
});
