import { requireUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { bookVisit, bookVisitSchema, listVisits } from "@/server/services/availability";

type Params = { ref: string };

export const GET = handle<Params>(async (_request, { params }) => {
  const { ref } = await params;
  return ok({ visits: await listVisits(await requireUser(), ref) });
});

/** Book or re-book the site visit: { availabilityId }. */
export const POST = handle<Params>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireUser();
  return created({ visits: await bookVisit(user, ref, await readJson(request, bookVisitSchema)) });
});
