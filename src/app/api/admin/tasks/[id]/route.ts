import { requireStaffUser } from "@/server/auth/session";
import { handle, noContent, ok, readJson } from "@/server/http";
import { deleteTask, updateTask, updateTaskSchema } from "@/server/services/tasks";

type Params = { id: string };

/** Move with { column, position }; edit any other field. */
export const PATCH = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const user = await requireStaffUser();
  return ok(await updateTask(user, id, await readJson(request, updateTaskSchema)));
});

export const DELETE = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  await deleteTask(await requireStaffUser(), id);
  return noContent();
});
