import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { handle, noContent, readJson } from "@/server/http";
import { changePassword } from "@/server/services/account";

/** Accepts `password` or `newPassword` for the new password. */
const body = z
  .object({ currentPassword: z.string(), password: z.string().optional(), newPassword: z.string().optional(), confirmPassword: z.string() })
  .transform(({ newPassword, password, ...rest }) => ({ ...rest, password: password ?? newPassword ?? "" }));

/** Changes the password and signs out every other session. */
export const POST = handle(async (request) => {
  const user = await requireUser();
  await changePassword(user, await readJson(request, body));
  return noContent();
});
