import { requireAdminUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { runBillingCycle } from "@/server/services/billing-cycle";

/** Run the billing job now (it is idempotent). */
export const POST = handle(async () => {
  await requireAdminUser();
  return ok(await runBillingCycle());
});
