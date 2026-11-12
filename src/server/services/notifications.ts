import "server-only";

import type { AuthUser } from "../auth/session";
import { db } from "../db";
import { notFound } from "../errors";

/**
 * In-app notifications (the bell in the dashboard top bar).
 *
 * Unread notifications of the same type on the same project are merged: a second message
 * updates the existing "New message" notification (count 2, latest text) instead of adding
 * a row, so a busy conversation stays one line in the list.
 */

export type NotificationType = "MESSAGE";

const toNotification = (row: any) => ({
  id: row.id as string,
  type: row.type as NotificationType,
  title: row.title as string,
  body: row.body as string,
  count: row.count as number,
  read: Boolean(row.readAt),
  at: (row.updatedAt as Date).toISOString(),
  /** Opening this marks it read, then redirects to the target page. */
  href: `/api/notifications/${row.id}/open`,
});
export type NotificationDto = ReturnType<typeof toNotification>;

type NewNotification = {
  userIds: string[];
  type: NotificationType;
  projectId?: string | null;
  title: string;
  /** Title used once several events are merged, e.g. "3 new messages on RET-2026-0001". */
  mergedTitle?: (count: number) => string;
  body?: string;
  href: string;
};

/** Create (or merge into an unread) notification for each recipient. Never throws: notifications are best-effort. */
export async function notify(input: NewNotification) {
  const recipients = [...new Set(input.userIds)];
  await Promise.all(
    recipients.map(async (userId) => {
      try {
        const open = await db.notification.findFirst({
          where: { userId, type: input.type, projectId: input.projectId ?? null, readAt: null },
          orderBy: { updatedAt: "desc" },
        });
        if (open) {
          const count = (open.count as number) + 1;
          await db.notification.update({
            where: { id: open.id },
            data: { count, title: input.mergedTitle ? input.mergedTitle(count) : input.title, body: input.body ?? "", href: input.href },
          });
        } else {
          await db.notification.create({
            data: { userId, type: input.type, projectId: input.projectId ?? null, title: input.title, body: input.body ?? "", href: input.href },
          });
        }
      } catch (error) {
        console.error("[notifications] failed for", userId, error);
      }
    }),
  );
}

/** Latest notifications for the bell, plus how many are unread. */
export async function listNotifications(user: AuthUser, limit = 15) {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: limit }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { items: rows.map(toNotification), unread };
}

/** Mark one read and return where it points. Only the owner can open it. */
export async function openNotification(user: AuthUser, id: string) {
  const row = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (!row) throw notFound("Notification");
  if (!row.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  return row.href as string;
}

export async function markAllNotificationsRead(user: AuthUser) {
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
}

/** Clear a project's notifications of one type for this user (e.g. once they've seen the conversation). */
export async function markProjectNotificationsRead(userId: string, projectId: string, type: NotificationType) {
  await db.notification.updateMany({ where: { userId, projectId, type, readAt: null }, data: { readAt: new Date() } }).catch(() => undefined);
}
