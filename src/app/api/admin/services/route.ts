import { requireAdminUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { createService, listServicesForAdmin, serviceInputSchema } from "@/server/services/catalog";

export const GET = handle(async () => {
  await requireAdminUser();
  return ok({ services: await listServicesForAdmin() });
});

export const POST = handle(async (request) => {
  const admin = await requireAdminUser();
  return created(await createService(admin.id, await readJson(request, serviceInputSchema)));
});
