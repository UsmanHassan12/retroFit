import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { offerSchema, offerTerms } from "@/server/services/partners";

/** Approve an application: { discountBps?, paymentMode, creditLimitPence? } → OFFERED. */
export const POST = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await offerTerms(admin.id, id, await readJson(request, offerSchema)));
});
