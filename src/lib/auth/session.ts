import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";

import { SESSION_COOKIE, SESSION_MAX_AGE, type Session } from "./types";

/**
 * Minimal signed-cookie session.
 *
 * This is deliberately small so the UI can be developed before the real backend exists.
 * Swap the internals for Auth.js / Better Auth / your API's JWT later — every caller goes
 * through getSession(), createSession() and deleteSession(), so nothing else needs to change.
 */

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production.");
  }
  return secret ?? "retrofit-portal-dev-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function encodeSession(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Verified session for the current request (memoised per render). */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
});

export async function createSession(user: Omit<Session, "expiresAt">) {
  const session: Session = { ...user, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 };
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return session;
}

export async function deleteSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
