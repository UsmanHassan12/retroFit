import "server-only";

import { redirect } from "next/navigation";

import { getSession } from "./session";
import { isStaff, type Session } from "./types";

/**
 * Data-access-layer guards for pages and layouts. proxy.ts does a fast redirect based on the
 * signed cookie; these do the authoritative check (including suspended / revoked sessions).
 * API routes use the throwing equivalents in src/server/auth/session.ts instead.
 */
export async function requireSession(next?: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
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
