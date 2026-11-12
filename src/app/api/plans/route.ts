import { handle, ok } from "@/server/http";
import { getTierCatalogue } from "@/server/services/billing";

/** Basic vs Premium Partner, with live prices from settings. */
export const GET = handle(async () => ok({ plans: await getTierCatalogue() }));
