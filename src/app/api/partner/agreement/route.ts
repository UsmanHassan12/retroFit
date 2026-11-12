import { requireUser } from "@/server/auth/session";
import { clientIp, handle, ok, readJson } from "@/server/http";
import { getAgreement, signAgreement, signSchema } from "@/server/services/partners";

/** The agreement with this partner's terms filled in. */
export const GET = handle(async () => ok(await getAgreement(await requireUser())));

/** E-sign: { fullName, accept: true, version }. Name, time, IP and version are stored. */
export const POST = handle(async (request) => {
  const user = await requireUser();
  return ok(await signAgreement(user, await readJson(request, signSchema), { ip: clientIp(request) }));
});
