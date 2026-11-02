import { requireUser } from "@/server/auth/session";
import { handle, ok } from "@/server/http";
import { clientDashboard } from "@/server/services/projects";

export const GET = handle(async () => ok(await clientDashboard(await requireUser())));
