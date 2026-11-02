import { badRequest, notFound } from "@/server/errors";
import { handle, ok, readJson } from "@/server/http";
import { acceptInvite, acceptInviteSchema, me, peekInvite } from "@/server/services/auth";

/** GET ?token= → { email, role } so the accept page can greet the invitee. */
export const GET = handle(async (request) => {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) throw badRequest("Missing token.");
  const invite = await peekInvite(token);
  if (!invite) throw notFound("Invitation");
  return ok(invite);
});

export const POST = handle(async (request) => {
  await acceptInvite(await readJson(request, acceptInviteSchema));
  return ok(await me());
});
