"use client";

import { Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { api } from "@/lib/api/client";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { Person, ProjectMessage } from "../types";

type ApiMessage = {
  id: string;
  body: string;
  mine: boolean;
  sentAt: string;
  author: { name: string; role: string; avatarUrl: string | null };
};

const POLL_MS = 10_000;

const toMessage = (message: ApiMessage): ProjectMessage => ({
  id: message.id,
  body: message.body,
  mine: message.mine,
  sentAt: message.sentAt,
  author: { name: message.author.name, role: message.author.role, avatar: message.author.avatarUrl ?? undefined },
});

/** Project chat. Sends through the messages API and polls for replies while the page is visible. */
export function ChatPanel({ projectRef, initialMessages, me }: { projectRef: string; initialMessages: ProjectMessage[]; me: Person }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const endpoint = `/api/projects/${encodeURIComponent(projectRef)}/messages`;
  const latest = messages.at(-1)?.sentAt;

  // Keep the newest message in view by scrolling the list itself (never the whole page).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Poll for new messages; pauses while the tab is hidden.
  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const query = latest ? `?after=${encodeURIComponent(latest)}` : "";
        const { messages: fresh } = await api<{ messages: ApiMessage[] }>(`${endpoint}${query}`);
        if (fresh.length) {
          setMessages((current) => {
            const known = new Set(current.map((message) => message.id));
            return [...current, ...fresh.filter((message) => !known.has(message.id)).map(toMessage)];
          });
        }
      } catch {
        // Network hiccup: try again on the next tick.
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [endpoint, latest]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = await api<ApiMessage>(endpoint, { method: "POST", json: { body } });
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, toMessage(message)]));
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Message not sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="project-chat">
      <h2 id="project-chat" className="text-[26px] font-semibold text-navy">
        Project Chat
      </h2>
      <div className="mt-6 flex h-[505px] flex-col rounded-2xl border border-dashed border-line bg-white p-5 shadow-card">
        <ol ref={listRef} className="flex-1 space-y-6 overflow-y-auto pr-1" aria-live="polite">
          {messages.length === 0 ? (
            <li className="pt-10 text-center text-sm text-muted">No messages yet. Say hello to your project team.</li>
          ) : null}
          {messages.map((message) => (
            <li key={message.id} className={cn("flex items-end gap-3", message.mine && "flex-row-reverse")}>
              <Avatar name={message.mine ? me.name : message.author.name} src={message.mine ? me.avatar : message.author.avatar} size={39} />
              <div
                className={cn(
                  "max-w-[75%] rounded-xl px-4 py-2.5 shadow-[0_3px_6px_rgb(11_28_48/0.15)]",
                  message.mine ? "bg-navy text-white" : "bg-white text-navy",
                )}
              >
                <p className="text-sm font-medium whitespace-pre-wrap">{message.body}</p>
                <p className={cn("mt-1 text-right text-[10px]", message.mine ? "text-white/60" : "text-faint")}>
                  {message.mine ? null : `${message.author.name} `}• <time dateTime={message.sentAt}>{formatTime(message.sentAt)}</time>
                </p>
              </div>
            </li>
          ))}
        </ol>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <form onSubmit={send} className="mt-4 flex gap-4">
          <label htmlFor="chat-message" className="sr-only">
            Type your message
          </label>
          <input
            id="chat-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your message..."
            autoComplete="off"
            maxLength={4000}
            className="h-[52px] flex-1 rounded-[10px] border border-line-soft bg-canvas px-4 text-sm placeholder:text-line focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim() || sending}
            className="flex h-[52px] w-[100px] items-center justify-center rounded-[10px] bg-navy text-white shadow-card transition-opacity disabled:opacity-60"
          >
            {sending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
          </button>
        </form>
      </div>
    </section>
  );
}
