import { requireUser } from "@/server/auth/session";
import { handle, noContent } from "@/server/http";
import { markAllNotificationsRead } from "@/server/services/notifications";

export const POST = handle(async () => {
  await markAllNotificationsRead(await requireUser());
  return noContent();
});
