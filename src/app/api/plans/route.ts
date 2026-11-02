import { handle, ok } from "@/server/http";
import { PLAN_CATALOGUE } from "@/server/services/billing";

export const GET = handle(async () => ok({ plans: PLAN_CATALOGUE }));
