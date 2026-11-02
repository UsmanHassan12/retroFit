/**
 * Typed application errors. Services throw these; the HTTP layer turns them into
 * `{ error: { code, message, details? } }` with the matching status, and server
 * actions turn them into form messages.
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "LOCKED"
  | "RATE_LIMITED"
  | "PAYMENT_REQUIRED"
  | "NOT_CONFIGURED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  LOCKED: 423,
  RATE_LIMITED: 429,
  PAYMENT_REQUIRED: 402,
  NOT_CONFIGURED: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const badRequest = (message: string, details?: unknown) => new AppError("BAD_REQUEST", message, details);
export const unauthenticated = (message = "Please sign in.") => new AppError("UNAUTHENTICATED", message);
export const forbidden = (message = "You don't have permission to do that.") => new AppError("FORBIDDEN", message);
export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found.`);
export const conflict = (message: string, details?: unknown) => new AppError("CONFLICT", message, details);
export const notConfigured = (message: string) => new AppError("NOT_CONFIGURED", message);
