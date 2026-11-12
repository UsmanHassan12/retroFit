import { timingSafeEqual } from "node:crypto";

import { env } from "@/server/env";
import { AppError, notConfigured } from "@/server/errors";
import { handle, ok } from "@/server/http";
import { runBillingCycle } from "@/server/services/billing-cycle";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduler entry point (Vercel Cron, GitHub Actions, or any cron with curl). Run hourly:
 * weekly invoices are created at the Friday 17:00 UK cut-off, reminders and holds follow
 * the settings, and every step is idempotent.
 *   Authorization: Bearer <CRON_SECRET>
 */
async function run(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) throw notConfigured("Set CRON_SECRET to enable scheduled jobs.");
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new AppError("UNAUTHENTICATED", "Bad cron secret.");
  return ok(await runBillingCycle());
}

export const GET = handle(run);
export const POST = handle(run);
