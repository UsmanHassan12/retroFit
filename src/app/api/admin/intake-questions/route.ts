import { requireAdminUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { listCommonQuestions, replaceCommonQuestions } from "@/server/services/catalog";

/** Common questions asked on every booking (service questions are edited with the service). */
export const GET = handle(async () => {
  await requireAdminUser();
  return ok({ questions: await listCommonQuestions() });
});

export const PUT = handle(async (request) => {
  const admin = await requireAdminUser();
  return ok({ questions: await replaceCommonQuestions(admin.id, await request.json()) });
});
