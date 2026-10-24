import "server-only";

import { redirect } from "next/navigation";

import { getSession } from "./session";
import { isStaff, type Session } from "./types";

/**
 * Data-access-layer guards. proxy.ts does a fast optimistic redirect; these do the real,
 * signature-verified check close to the data, as recommended by the Next.js auth guide.
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
