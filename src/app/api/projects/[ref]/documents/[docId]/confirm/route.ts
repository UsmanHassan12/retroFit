import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { confirmUpload } from "@/server/services/documents";

export const POST = handle<{ ref: string; docId: string }>(async (_request, { params }) => {
  const { ref, docId } = await params;
  return ok(await confirmUpload(await requireUser(), ref, docId));
});
