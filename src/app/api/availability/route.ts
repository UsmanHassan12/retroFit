import { handle, ok, readQuery } from "@/server/http";
import { listSlots } from "@/server/services/availability";

/** GET /api/availability?postcode=NW10 6RF&from=&to= — free AM / PM visit windows. */
export const GET = handle(async (request) => ok({ slots: await listSlots(readQuery(request)) }));
