import { requireStaffUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { createTask, createTaskSchema, getBoard } from "@/server/services/tasks";

type Params = { ref: string };

export const GET = handle<Params>(async (_request, { params }) => {
  const { ref } = await params;
  return ok(await getBoard(await requireStaffUser(), ref));
});

export const POST = handle<Params>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireStaffUser();
  return created(await createTask(user, ref, await readJson(request, createTaskSchema)));
});
