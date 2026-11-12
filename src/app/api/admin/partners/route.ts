import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readQuery } from "@/server/http";
import { adminListPartners } from "@/server/services/partners";

/** ?status=APPLIED&q= */
export const GET = handle(async (request) => {
  await requireAdminUser();
  return ok({ partners: await adminListPartners(readQuery(request)) });
});
