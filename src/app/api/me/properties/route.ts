import { requireUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { createProperty, listProperties, propertySchema } from "@/server/services/account";

export const GET = handle(async () => ok({ properties: await listProperties(await requireUser()) }));

export const POST = handle(async (request) => {
  const user = await requireUser();
  return created(await createProperty(user, await readJson(request, propertySchema)));
});
