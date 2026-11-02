import { requireAdminUser } from "@/server/auth/session";
import { created, handle, readJson } from "@/server/http";
import { mediaUploadSchema, requestMediaUpload } from "@/server/services/media";

/** Service images → { key, publicUrl, upload: { url, method, headers } }. */
export const POST = handle(async (request) => {
  await requireAdminUser();
  return created(await requestMediaUpload(await readJson(request, mediaUploadSchema)));
});
