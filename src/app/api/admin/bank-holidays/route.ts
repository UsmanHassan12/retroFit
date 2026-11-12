import { requireAdminUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { listBankHolidays, saveBankHolidays } from "@/server/services/settings";

export const GET = handle(async () => {
  await requireAdminUser();
  return ok({ holidays: await listBankHolidays() });
});

/** Replace the holidays for the years in the body: [{ date: "2027-01-01", name }]. */
export const PUT = handle(async (request) => {
  const admin = await requireAdminUser();
  return ok({ holidays: await saveBankHolidays(admin.id, await request.json()) });
});
