import { requireUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { listDocuments, requestUpload, requestUploadSchema } from "@/server/services/documents";

type Params = { ref: string };

/** ?all=true lists every version, otherwise the latest of each file. */
export const GET = handle<Params>(async (request, { params }) => {
  const { ref } = await params;
  const all = new URL(request.url).searchParams.get("all") === "true";
  return ok({ documents: await listDocuments(await requireUser(), ref, { all }) });
});

/** → { document, upload: { url, method, headers } }. PUT the file to upload.url, then call /confirm. */
export const POST = handle<Params>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireUser();
  return created(await requestUpload(user, ref, await readJson(request, requestUploadSchema)));
});
