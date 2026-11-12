import { requireUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { cancelProject, cancelSchema, previewCancellation } from "@/server/services/projects";

type Params = { ref: string };

/** What cancelling now would cost: { percent, reason, feePence, refundPence, refundTo }. */
export const GET = handle<Params>(async (_request, { params }) => {
  const { ref } = await params;
  return ok(await previewCancellation(await requireUser(), ref));
});

/** Cancel: { reason, expectedFeePence? } (the fee is re-checked so the client isn't surprised). */
export const POST = handle<Params>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireUser();
  return ok(await cancelProject(user, ref, await readJson(request, cancelSchema)));
});
