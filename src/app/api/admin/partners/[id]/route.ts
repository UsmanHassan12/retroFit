import { requireAdminUser } from "@/server/auth/session";
import { handle, ok, readJson } from "@/server/http";
import { adminGetPartner, partnerPatchSchema, updatePartner } from "@/server/services/partners";

type Params = { id: string };

/** Partner with credit balance, exposure (unbilled + unpaid) and holds. */
export const GET = handle<Params>(async (_request, { params }) => {
  const { id } = await params;
  await requireAdminUser();
  return ok(await adminGetPartner(id));
});

/** Change terms (new bookings only) or status (SUSPENDED, ACTIVE, CANCELLED, REJECTED). */
export const PATCH = handle<Params>(async (request, { params }) => {
  const { id } = await params;
  const admin = await requireAdminUser();
  return ok(await updatePartner(admin.id, id, await readJson(request, partnerPatchSchema)));
});
