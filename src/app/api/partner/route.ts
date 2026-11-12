import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { getMyPartnership } from "@/server/services/partners";

/** The signed-in user's Premium Partner status and next step. */
export const GET = handle(async () => ok(await getMyPartnership(await requireUser())));
