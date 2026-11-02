import { requireAdminUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { integrationStatus } from "@/server/services/admin";

export const GET = handle(async () => {
  await requireAdminUser();
  return ok({ integrations: await integrationStatus() });
});
