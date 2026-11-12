import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { AppError, badRequest, isAppError } from "./errors";

/**
 * Thin helpers for route handlers. Every handler is wrapped in `handle()`, so services can
 * simply throw AppError / ZodError and the response shape stays consistent:
 *   { error: { code, message, details? } }
 */

type Context<P> = { params: Promise<P> };
type Handler<P> = (request: Request, context: Context<P>) => Promise<Response> | Response;

export function handle<P extends object = object>(handler: Handler<P>) {
  return async (request: Request, context: Context<P>): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      { status: error.status },
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Some fields are invalid.", details: fieldErrors(error) } },
      { status: 422 },
    );
  }
  // Next.js control flow (redirect / notFound) must keep propagating.
  if (error && typeof error === "object" && "digest" in error) throw error;

  console.error("[api] Unhandled error", error);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 });
}

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);
export const created = <T>(data: T) => NextResponse.json(data, { status: 201 });
export const noContent = () => new NextResponse(null, { status: 204 });

/** Parse and validate a JSON body. */
export async function readJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(body);
}

/** The query string as a plain record (repeated keys joined with commas); services validate it. */
export function readQuery(request: Request): Record<string, string> {
  const params = new URL(request.url).searchParams;
  const record: Record<string, string> = {};
  for (const key of new Set(params.keys())) record[key] = params.getAll(key).join(",");
  return record;
}

/** Best-effort client IP (behind Vercel / a proxy), stored with consents and signatures. */
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

/** Optional JSON body: an empty body parses as {}. */
export async function readOptionalJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  const text = await request.text();
  if (!text.trim()) return schema.parse({});
  try {
    return schema.parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw badRequest("Request body must be valid JSON.");
    throw error;
  }
}

/** First message per field, keyed by dotted path. */
export function fieldErrors(error: z.ZodError) {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    result[key] ??= issue.message;
  }
  return result;
}

/** For server actions: turn any thrown error into a user-facing message. */
export function messageFor(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof AppError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  console.error(error);
  return fallback;
}

/** Re-throw Next.js navigation signals (redirect / notFound) caught by a try/catch. */
export function rethrowNavigation(error: unknown) {
  if (error && typeof error === "object" && "digest" in error) {
    const digest = String((error as { digest: unknown }).digest);
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND") {
      throw error;
    }
  }
}
