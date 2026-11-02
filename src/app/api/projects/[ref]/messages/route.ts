import { requireUser } from "@/server/auth/session";
import { created, handle, ok, readJson, readQuery } from "@/server/http";
import { listMessages, postMessage, postMessageSchema } from "@/server/services/messages";

type Params = { ref: string };

/** ?after=<ISO timestamp> returns only newer messages (for polling). */
export const GET = handle<Params>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireUser();
  return ok({ messages: await listMessages(user, ref, readQuery(request)) });
});

export const POST = handle<Params>(async (request, { params }) => {
  const { ref } = await params;
  const user = await requireUser();
  return created(await postMessage(user, ref, await readJson(request, postMessageSchema)));
});
