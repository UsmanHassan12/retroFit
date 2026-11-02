import { handle, ok, readQuery } from "@/server/http";
import { listServices } from "@/server/services/catalog";

/** GET /api/services?q=&category=ASSESSMENT,DESIGN&budget=500-1000|1000+ */
export const GET = handle(async (request) => {
  const services = await listServices(readQuery(request));
  return ok({ services });
});
