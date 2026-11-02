import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { listProjectTasks } from "@/server/services/tasks";

export const GET = handle<{ ref: string }>(async (_request, { params }) => {
  const { ref } = await params;
  return ok({ tasks: await listProjectTasks(await requireUser(), ref) });
});
