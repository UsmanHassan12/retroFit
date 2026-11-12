import { requireAdminUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { updateSettingsSection } from "@/server/services/settings";

/** Update one section (vat, partner, billing, booking, cancellation, revisions, seller). Partial bodies merge. */
export const PUT = handle<{ section: string }>(async (request, { params }) => {
  const { section } = await params;
  const admin = await requireAdminUser();
  return ok(await updateSettingsSection(admin.id, section, await request.json()));
});
