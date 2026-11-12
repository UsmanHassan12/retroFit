import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/server/auth/session";

import type { Role, Session } from "./types";

/**
 * The signed-in user as pages and layouts see it. Backed by the verified JWT cookie and a
 * fresh user lookup (src/server/auth/session.ts), so suspensions and role changes apply
 * immediately. Sign-in / sign-out live in features/auth/actions.ts.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  return {
    userId: user.id,
    name: user.name,
    firstName: user.firstName || user.name.split(" ")[0]!,
    email: user.email,
    role: user.role.toLowerCase() as Role,
    avatarUrl: user.avatarUrl,
    tier: user.tier === "PARTNER" ? "partner" : "basic",
    impersonating: Boolean(user.impersonatorId),
    expiresAt: user.expiresAt,
  };
});
