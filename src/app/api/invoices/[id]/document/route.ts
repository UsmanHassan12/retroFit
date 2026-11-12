import { requireUser } from "@/server/auth/session";
import { handle } from "@/server/http";
import { renderInvoiceDocument } from "@/server/services/invoices";

/** Printable VAT invoice / receipt (HTML; print to PDF from the browser). */
export const GET = handle<{ id: string }>(async (_request, { params }) => {
  const { id } = await params;
  const html = await renderInvoiceDocument(await requireUser(), id);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
});
