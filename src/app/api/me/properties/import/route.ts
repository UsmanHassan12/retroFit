import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { badRequest } from "@/server/errors";
import { handle, ok } from "@/server/http";
import { importPropertiesCsv } from "@/server/services/account";

/** Bulk property upload. Send the CSV as text/csv, or JSON { csv }. */
export const POST = handle(async (request) => {
  const user = await requireUser();
  const type = request.headers.get("content-type") ?? "";
  const csv = type.includes("application/json") ? z.object({ csv: z.string().min(1) }).parse(await request.json()).csv : await request.text();
  if (csv.length > 2_000_000) throw badRequest("The file is too large (2MB max).");
  return ok(await importPropertiesCsv(user, csv));
});
