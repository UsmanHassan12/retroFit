import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readQuery } from "@/server/http";
import { adminListInvoices } from "@/server/services/invoices";

/** ?status=OVERDUE&kind=WEEKLY&userId=&page= */
export const GET = handle(async (request) => {
  await requireAdminUser();
  return ok(await adminListInvoices(readQuery(request)));
});
