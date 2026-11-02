import { requireUser } from "@/server/auth/session";
import { created, handle, ok, readJson } from "@/server/http";
import { createDeliverable, deliverableSchema, listDeliverables } from "@/server/services/deliverables";

type Params = { ref: string };

export const GET = handle<Params>(async (_request, { params }) => {
  const { ref } = await params;
  return ok({ deliverables: await listDeliverables(await requireUser(), ref) });
});

/** Staff only. */
export const POST = handle<Params>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireUser();
  return created(await createDeliverable(user, ref, await readJson(request, deliverableSchema)));
});
