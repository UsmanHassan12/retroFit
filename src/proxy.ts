import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, homeForRole, isStaff, type Session } from "@/lib/auth/types";

/**
 * Next.js 16 proxy (formerly middleware).
 * Optimistic routing only: it reads the session claims without verifying the signature.
 * Protected layouts re-check with the signed session via lib/auth/guards.ts.
 */

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/checkout"];
const AUTH_PAGES = ["/login", "/signup"];

function readClaims(token: string | undefined): Pick<Session, "role" | "expiresAt"> | null {
  if (!token) return null;
  const [payload] = token.split(".");
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as Session;
    return claims.expiresAt > Date.now() ? claims : null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const claims = readClaims(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !claims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && claims && !isStaff(claims.role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (AUTH_PAGES.includes(pathname) && claims) {
    return NextResponse.redirect(new URL(homeForRole(claims.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/checkout/:path*", "/login", "/signup"],
};
