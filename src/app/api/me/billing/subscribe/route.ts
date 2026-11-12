import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { startSubscription } from "@/server/services/partners";

/**
 * Kept for old clients: the £29 Priority plan is gone. This now starts the Premium Partner
 * subscription (same as POST /api/partner/subscription).
 */
export const POST = handle(async () => ok(await startSubscription(await requireUser())));
