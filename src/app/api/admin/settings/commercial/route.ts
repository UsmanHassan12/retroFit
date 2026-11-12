import { requireAdminUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { defaultSettings, getSettings } from "@/server/services/settings";

/** Every commercial setting, with the draft defaults for comparison. */
export const GET = handle(async () => {
  await requireAdminUser();
  return ok({ settings: await getSettings(), defaults: defaultSettings() });
});
