import { z } from "zod";

import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { settleInvoice } from "@/server/services/billing";
import { toInvoiceDto } from "@/server/services/invoices";

const schema = z.object({ via: z.enum(["BANK_TRANSFER", "CARD", "OTHER"]).default("BANK_TRANSFER"), note: z.string().trim().max(300).optional() });

/** Record a payment received outside Stripe (bank transfer). Lifts automatic holds when settled. */
export const POST = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  const data = await readJson(request, schema);
  return ok(toInvoiceDto(await settleInvoice(id, { via: data.via, note: data.note ?? null, actorId: admin.id })));
});
