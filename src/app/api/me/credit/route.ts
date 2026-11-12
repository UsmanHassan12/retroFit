import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { creditStatement } from "@/server/services/credit";

export const GET = handle(async () => ok(await creditStatement((await requireUser()).id)));
