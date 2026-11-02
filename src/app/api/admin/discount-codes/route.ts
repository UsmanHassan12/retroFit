import { requireAdminUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { createDiscountCode, discountSchema, listDiscountCodes } from "@/server/services/admin";

export const GET = handle(async () => {
  await requireAdminUser();
  return ok({ discountCodes: await listDiscountCodes() });
});

export const POST = handle(async (request) => {
  const admin = await requireAdminUser();
  return created(await createDiscountCode(admin, await readJson(request, discountSchema)));
});
