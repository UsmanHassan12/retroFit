import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSession } from "./session";
import { SESSION_COOKIE, isStaff, type Session } from "./types";

/**
 * Data-access-layer guards for pages and layouts. proxy.ts does a fast redirect based on the
 * signed cookie; these do the authoritative check (including suspended / revoked sessions).
 * API routes use the throwing equivalents in src/server/auth/session.ts instead.
 */
export async function requireSession(next?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const query = next ? `?next=${encodeURIComponent(next)}` : "";
    // A cookie is present but doesn't match a user: clear it first (a page can't delete cookies),
    // otherwise the proxy would keep treating the visitor as signed in.
    if ((await cookies()).has(SESSION_COOKIE)) redirect(`/api/auth/reset-session${query}`);
    redirect(`/login${query}`);
  }
  return session;
}

export async function requireStaff(): Promise<Session> {
  const session = await requireSession("/admin");
  if (!isStaff(session.role)) redirect("/dashboard");
  return session;
}

/** Services, users and settings are ADMIN only (README → Roles). */
export async function requireAdmin(): Promise<Session> {
  const session = await requireStaff();
  if (session.role !== "admin") redirect("/admin");
  return session;
}
