import { requireUser } from "@/server/auth/session";
import { handle } from "@/server/http";
import { openNotification } from "@/server/services/notifications";

/** Marks the notification read and redirects to what it's about (e.g. the project conversation). */
export const GET = handle<{ id: string }>(async (request, { params }) => {
  const { id } = await params;
  const href = await openNotification(await requireUser(), id);
  return Response.redirect(new URL(href, request.url), 303);
});
