import "server-only";

import { db } from "../db";

/** Append-only audit trail for sensitive admin actions. Never blocks the action itself. */
export async function audit(actorId: string | null, action: string, targetType?: string, targetId?: string, meta?: Record<string, unknown>) {
  try {
    await db.auditLog.create({ data: { actorId, action, targetType, targetId, meta: meta as never } });
  } catch (error) {
    console.error("[audit] failed to record", action, error);
  }
}
