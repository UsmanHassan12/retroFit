import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, homeForRole, isStaff } from "@/lib/auth/types";
import { verifyJwt } from "@/server/auth/jwt";

/**
 * Next.js 16 proxy (formerly middleware). Verifies the session JWT's signature and expiry and
 * redirects early. It does not hit the database, so revoked sessions are caught a moment later
 * by the page guards (lib/auth/guards.ts) and API helpers (server/auth/session.ts).
 */

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/checkout"];
const AUTH_PAGES = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const secret = process.env.AUTH_SECRET ?? process.env.SESSION_SECRET ?? "";
  const claims = secret ? await verifyJwt(request.cookies.get(SESSION_COOKIE)?.value, secret) : null;

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
