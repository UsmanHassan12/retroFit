import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "../db";
import { env, isProduction } from "../env";
import { forbidden, unauthenticated } from "../errors";
import { isStaffRole, type CustomerTier, type Role } from "../domain";
import { signJwt, verifyJwt } from "./jwt";

export const SESSION_COOKIE = "rp_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const IMPERSONATION_TTL_SECONDS = 60 * 60; // 1 hour

/** The signed-in user, as every service sees it. */
export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: Role;
  /** BASIC, or PARTNER while the user's Premium Partner profile is ACTIVE. */
  tier: CustomerTier;
  avatarUrl: string | null;
  canViewAllProjects: boolean;
  /** Set while an admin is impersonating this user. */
  impersonatorId: string | null;
  expiresAt: number;
};

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
  partnerProfile: { select: { status: true } },
  status: true,
  canViewAllProjects: true,
  sessionVersion: true,
} as const;

export const displayName = (user: { firstName: string; lastName: string; email: string }) =>
  `${user.firstName} ${user.lastName}`.trim() || user.email.split("@")[0]!;

/** Verified user for this request (memoised per request). Null when signed out or revoked. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const claims = await verifyJwt(store.get(SESSION_COOKIE)?.value, env().AUTH_SECRET);
  if (!claims) return null;

  const user = await db.user.findUnique({ where: { id: claims.sub }, select: userSelect });
  if (!user || user.status !== "ACTIVE" || user.sessionVersion !== claims.sv) return null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: displayName(user),
    role: user.role as Role,
    tier: user.partnerProfile?.status === "ACTIVE" ? "PARTNER" : "BASIC",
    avatarUrl: user.avatarUrl,
    canViewAllProjects: user.canViewAllProjects,
    impersonatorId: claims.imp ?? null,
    expiresAt: claims.exp * 1000,
  };
});

/** For API routes and services: throw 401 instead of redirecting. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}

export async function requireStaffUser() {
  const user = await requireUser();
  if (!isStaffRole(user.role)) throw forbidden();
  return user;
}

export async function requireAdminUser() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw forbidden("Only administrators can do that.");
  return user;
}

export async function startSession(
  user: { id: string; role: string; sessionVersion: number },
  options: { impersonatorId?: string; ttlSeconds?: number } = {},
) {
  const ttl = options.ttlSeconds ?? SESSION_TTL_SECONDS;
  const token = await signJwt(
    { sub: user.id, role: user.role, sv: user.sessionVersion, ...(options.impersonatorId ? { imp: options.impersonatorId } : {}) },
    env().AUTH_SECRET,
    ttl,
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
