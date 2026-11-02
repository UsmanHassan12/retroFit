import "server-only";

import { z } from "zod";

/**
 * Validated server configuration. Read once; a missing required value fails fast with a
 * readable message instead of an obscure runtime error deep inside a request.
 * Optional integrations (Stripe, S3, SendGrid) switch to safe local fallbacks when unset.
 */

const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see .env.example)."),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters (see .env.example)."),
  APP_URL: z.string().url().default("http://localhost:3000"),

  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PRICE_PRIORITY: optional,

  AWS_REGION: z.string().default("eu-west-2"),
  S3_BUCKET: optional,

  SENDGRID_API_KEY: optional,
  EMAIL_FROM: z.string().default("Retrofit Portal <no-reply@retrofitportal.co.uk>"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse({
    ...process.env,
    // Accept the old frontend variable names so existing .env.local files keep working.
    AUTH_SECRET: process.env.AUTH_SECRET ?? process.env.SESSION_SECRET,
    APP_URL: process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

export const integrations = {
  stripe: () => Boolean(env().STRIPE_SECRET_KEY),
  s3: () => Boolean(env().S3_BUCKET),
  sendgrid: () => Boolean(env().SENDGRID_API_KEY),
};

/** Absolute URL on this site. */
export const appUrl = (path = "/") => new URL(path, env().APP_URL).toString();
