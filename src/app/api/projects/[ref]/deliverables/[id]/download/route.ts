import { requireUser } from "@/server/auth/session";
import { handle } from "@/server/http";
import { deliverableDownload } from "@/server/services/deliverables";

/** Redirects to a short-lived signed URL (latest version, or ?version=N). Blocked while on hold. */
export const GET = handle<{ ref: string; id: string }>(async (request, { params }) => {
  const { ref, id } = await params;
  const version = Number(new URL(request.url).searchParams.get("version")) || undefined;
  return Response.redirect(await deliverableDownload(await requireUser(), ref, id, version), 302);
});
