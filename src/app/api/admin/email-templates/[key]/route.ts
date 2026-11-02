import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { getTemplate, resetTemplate, saveTemplate, templateKeySchema, templateSchema } from "@/server/services/admin";

type Params = { key: string };

export const GET = handle<Params>(async (_request, { params }) => {
  await requireAdminUser();
  return ok(await getTemplate(templateKeySchema.parse((await params).key)));
});

export const PUT = handle<Params>(async (request, { params }) => {
  const admin = await requireAdminUser();
  const key = templateKeySchema.parse((await params).key);
  return ok(await saveTemplate(admin, key, await readJson(request, templateSchema)));
});

/** Reset to the built-in default. */
export const DELETE = handle<Params>(async (_request, { params }) => {
  const admin = await requireAdminUser();
  return ok(await resetTemplate(admin, templateKeySchema.parse((await params).key)));
});
