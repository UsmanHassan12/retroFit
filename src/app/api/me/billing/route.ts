import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { getBilling } from "@/server/services/billing";

export const GET = handle(async () => ok(await getBilling(await requireUser())));
