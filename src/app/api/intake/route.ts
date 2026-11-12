import { handle, ok, readQuery } from "@/server/http";
import { getIntakeForm } from "@/server/services/intake";

/** GET /api/intake?services=RA,RD&bundle=RA-RD-RC — the booking form definition. */
export const GET = handle(async (request) => {
  const query = readQuery(request);
  const services = (query.services ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return ok(await getIntakeForm({ services, bundle: query.bundle || null }));
});
