import { z } from "zod";

import { requireAdminUser } from "@/server/auth/session";
import { handle, noContent, readJson } from "@/server/http";
import { voidInvoice } from "@/server/services/invoices";

/** Void an unpaid invoice: { reason }. Its bookings become billable again. */
export const POST = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  const { reason } = await readJson(request, z.object({ reason: z.string().trim().min(3).max(300) }));
  await voidInvoice(admin.id, id, reason);
  return noContent();
});
