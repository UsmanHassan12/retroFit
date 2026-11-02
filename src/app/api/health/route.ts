import { db } from "@/server/db";
import { integrations } from "@/server/env";
import { handle, ok } from "@/server/http";

export const dynamic = "force-dynamic";

/** Liveness + database check. */
export const GET = handle(async () => {
  const started = Date.now();
  let database = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    database = "unreachable";
  }
  return ok(
    {
      status: database === "ok" ? "ok" : "degraded",
      database,
      latencyMs: Date.now() - started,
      integrations: { stripe: integrations.stripe(), s3: integrations.s3(), sendgrid: integrations.sendgrid() },
      time: new Date().toISOString(),
    },
    { status: database === "ok" ? 200 : 503 },
  );
});
