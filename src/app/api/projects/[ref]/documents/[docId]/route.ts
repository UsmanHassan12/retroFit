import { requireUser } from "@/server/auth/session";
import { handle, noContent, ok } from "@/server/http";
import { deleteDocument, getDocument } from "@/server/services/documents";

type Params = { ref: string; docId: string };

/** Metadata + a short-lived downloadUrl. Add ?download=1 to be redirected straight to the file. */
export const GET = handle<Params>(async (request, { params }) => {
  const { ref, docId } = await params;
  const document = await getDocument(await requireUser(), ref, docId);
  if (new URL(request.url).searchParams.get("download")) return Response.redirect(document.downloadUrl, 302);
  return ok(document);
});

export const DELETE = handle<Params>(async (_request, { params }) => {
  const { ref, docId } = await params;
  await deleteDocument(await requireUser(), ref, docId);
  return noContent();
});
