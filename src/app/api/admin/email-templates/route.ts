import { requireAdminUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { listTemplates } from "@/server/services/admin";

export const GET = handle(async () => {
  await requireAdminUser();
  return ok({ templates: await listTemplates() });
});
