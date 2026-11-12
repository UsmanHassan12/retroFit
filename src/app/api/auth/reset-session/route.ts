import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/types";

/**
 * GET /api/auth/reset-session?next=/dashboard
 *
 * Clears a session cookie that is validly signed but no longer matches a user (deleted,
 * suspended, signed out elsewhere, or the database was reset), then sends the visitor to the
 * login page. Page guards redirect here instead of straight to /login so a stale cookie can
 * never cause a redirect loop between the proxy and the guards.
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const login = new URL("/login", request.url);
  if (next?.startsWith("/") && !next.startsWith("//")) login.searchParams.set("next", next);
  const response = NextResponse.redirect(login);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
