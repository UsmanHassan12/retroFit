import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { cancelSubscription, startSubscription } from "@/server/services/partners";

/** Start the monthly subscription → { url } (activates the partner account). */
export const POST = handle(async () => ok(await startSubscription(await requireUser())));

/** Give notice: the subscription ends after the notice period. */
export const DELETE = handle(async () => ok(await cancelSubscription(await requireUser())));
