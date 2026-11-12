import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { bundleSchema, saveBundle } from "@/server/services/catalog";

export const PUT = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await saveBundle(admin.id, id, await readJson(request, bundleSchema)));
});
