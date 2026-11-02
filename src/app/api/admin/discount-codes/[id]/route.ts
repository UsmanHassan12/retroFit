import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { discountPatchSchema, updateDiscountCode } from "@/server/services/admin";

export const PATCH = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await updateDiscountCode(admin, id, await readJson(request, discountPatchSchema)));
});
