"use client";

import { Bell, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BellNotification = { id: string; type: string; title: string; body: string; count: number; read: boolean; at: string; href: string };
export type BellData = { items: BellNotification[]; unread: number };

const POLL_MS = 30_000;

/**
 * Top-bar bell. Shows the unread count, a dropdown of recent notifications, and polls for
 * new ones while the tab is visible. Each item is a client-side link to the page it's about
 * (no full reload); clicking also marks it read in the background.
 */
export function NotificationBell({ initial }: { initial: BellData }) {
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { headers: { Accept: "application/json" }, credentials: "same-origin" });
      if (response.ok) setData(await response.json());
    } catch {
      // Offline or signed out: keep what we have.
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markAllRead() {
    setData((current) => ({ unread: 0, items: current.items.map((item) => ({ ...item, read: true })) }));
    await fetch("/api/notifications/read-all", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
  }

  /** Mark read straight away in the UI and in the background; the <Link> does the navigation. */
  function markRead(item: BellNotification) {
    setOpen(false);
    // Lets an already-open chat fetch the new message now instead of on its next poll.
    window.dispatchEvent(new Event("notification:open"));
    if (item.read) return;
    setData((current) => ({
      unread: Math.max(0, current.unread - 1),
      items: current.items.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)),
    }));
    // keepalive lets the request finish even if the click opened a new tab or the page changes.
    void fetch(`/api/notifications/${item.id}/open`, { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => undefined);
  }

  const unread = data.unread;
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          if (!open) void refresh();
          setOpen((value) => !value);
        }}
        className="relative rounded-lg p-2 text-navy hover:bg-white"
      >
        <Bell className="size-5" aria-hidden />
        {unread ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-white tabular-nums ring-2 ring-canvas">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id="notification-panel"
          role="region"
          aria-label="Notifications"
          className="absolute top-full right-0 z-50 mt-2 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-line-soft bg-white shadow-float"
        >
          <div className="flex items-center justify-between gap-3 border-b border-dotted border-line px-4 py-3">
            <p className="text-sm font-semibold text-navy">Notifications</p>
            {unread ? (
              <button type="button" onClick={markAllRead} className="text-xs font-medium text-ocean hover:text-brand">
                Mark all as read
              </button>
            ) : null}
          </div>
          {data.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">You’re all caught up. New messages will show here.</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {data.items.map((item) => (
                <li key={item.id} className="border-b border-dotted border-line last:border-0">
                  <Link href={item.href} onClick={() => markRead(item)} className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-canvas", !item.read && "bg-brand-100/30")}>
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", item.read ? "bg-canvas text-muted" : "bg-brand-100 text-brand-700")}>
                      <MessageSquare className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", item.read ? "text-muted" : "font-semibold text-navy")}>
                        {item.title}
                        {!item.read ? <span className="sr-only"> (unread)</span> : null}
                      </span>
                      {item.body ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{item.body}</span> : null}
                      <span className="mt-1 block text-[11px] text-faint">{formatRelative(item.at)}</span>
                    </span>
                    {!item.read ? <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-brand" /> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
