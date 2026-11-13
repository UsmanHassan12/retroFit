import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { openNotification } from "@/server/services/notifications";

type Params = { id: string };

/** Mark read and return where it points. The bell calls this, then navigates without a page reload. */
export const POST = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  return ok({ href: await openNotification(await requireUser(), id) });
});

/** Same, as a redirect: for links outside the app (e.g. an email) where a full page load is expected. */
export const GET = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const href = await openNotification(await requireUser(), id);
  return Response.redirect(new URL(href, request.url), 303);
});
