import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { listNotifications } from "@/server/services/notifications";

/** The signed-in user's latest notifications and unread count (the bell polls this). */
export const GET = handle(async () => ok(await listNotifications(await requireUser())));
