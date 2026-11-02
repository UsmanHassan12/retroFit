import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { previewTemplate, templateKeySchema, templateSchema } from "@/server/services/admin";

/** Body (optional): unsaved { subject, html } to preview with sample data. */
export const POST = handle<{ key: string }>(async (request, { params }) => {
  await requireAdminUser();
  const key = templateKeySchema.parse((await params).key);
  const draft = request.headers.get("content-length") === "0" ? {} : await readJson(request, templateSchema.partial()).catch(() => ({}));
  return ok(await previewTemplate(key, draft));
});
