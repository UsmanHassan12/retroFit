import { requireAdminUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { bundleSchema, listBundles, saveBundle } from "@/server/services/catalog";

export const GET = handle(async () => {
  await requireAdminUser();
  return ok({ bundles: await listBundles({ includeInactive: true }) });
});

export const POST = handle(async (request) => {
  const admin = await requireAdminUser();
  return created(await saveBundle(admin.id, null, await readJson(request, bundleSchema)));
});
