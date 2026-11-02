import { requireUser } from "@/server/auth/session";
import { handle } from "@/server/http";
import { deliverableDownload } from "@/server/services/deliverables";

/** Redirects to a short-lived signed URL for the deliverable's file. */
export const GET = handle<{ ref: string; id: string }>(async (_request, { params }) => {
  const { ref, id } = await params;
  return Response.redirect(await deliverableDownload(await requireUser(), ref, id), 302);
});
