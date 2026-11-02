import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import {
  deleteService,
  getServiceForAdmin,
  patchService,
  replaceService,
  serviceInputSchema,
  servicePatchSchema,
} from "@/server/services/catalog";

type Params = { id: string };

export const GET = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  await requireAdminUser();
  return ok(await getServiceForAdmin(id));
});

/** Full replace (tiers / add-ons / milestones included). */
export const PUT = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await replaceService(admin.id, id, await readJson(request, serviceInputSchema)));
});

/** Quick edits such as { active: false }. */
export const PATCH = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await patchService(admin.id, id, await readJson(request, servicePatchSchema)));
});

/** Deletes, or deactivates when orders exist. */
export const DELETE = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await deleteService(admin.id, id));
});
