import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { serviceDiscountsSchema, setServiceDiscounts } from "@/server/services/partners";

/** Per-service overrides: [{ serviceId, discountBps | null }]. */
export const PUT = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await setServiceDiscounts(admin.id, id, await readJson(request, serviceDiscountsSchema)));
});
