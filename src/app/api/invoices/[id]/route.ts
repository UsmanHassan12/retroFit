import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { getInvoice, toInvoiceDto } from "@/server/services/invoices";

export const GET = handle<{ id: string }>(async (_request, { params }) => {
  const { id } = await params;
  return ok(toInvoiceDto(await getInvoice(await requireUser(), id)));
});
