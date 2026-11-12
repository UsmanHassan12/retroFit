import { requireAdminUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { adjustmentSchema, adminCreditEntry, creditStatement } from "@/server/services/credit";

type Params = { id: string };

export const GET = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  await requireAdminUser();
  return ok(await creditStatement(id, 200));
});

/** Bank-transfer top-up { type: "TOPUP", amountPence, note }, or an adjustment / refund. */
export const POST = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return created(await adminCreditEntry(admin.id, id, await readJson(request, adjustmentSchema)));
});
