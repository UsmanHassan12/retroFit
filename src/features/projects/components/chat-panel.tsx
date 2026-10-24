"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import type { Person, ProjectMessage } from "../types";

/** Project chat. Messages are optimistic/local until the realtime messaging API is connected. */
export function ChatPanel({ initialMessages, me }: { initialMessages: ProjectMessage[]; me: Person }) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the newest message in view by scrolling the list itself (never the whole page).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function send(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const sentAt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    setMessages((current) => [...current, { id: crypto.randomUUID(), author: me, body, sentAt, mine: true }]);
    setDraft("");
  }

  return (
    <section aria-labelledby="project-chat">
      <h2 id="project-chat" className="text-[26px] font-semibold text-navy">
        Project Chat
      </h2>
      <div className="mt-6 flex h-[505px] flex-col rounded-2xl border border-dashed border-line bg-white p-5 shadow-card">
        <ol ref={listRef} className="flex-1 space-y-6 overflow-y-auto pr-1" aria-live="polite">
          {messages.map((message) => (
            <li key={message.id} className={cn("flex items-end gap-3", message.mine && "flex-row-reverse")}>
              <Avatar name={message.author.name} src={message.author.avatar} size={39} />
              <div
                className={cn(
                  "max-w-[75%] rounded-xl px-4 py-2.5 shadow-[0_3px_6px_rgb(11_28_48/0.15)]",
                  message.mine ? "bg-navy text-white" : "bg-white text-navy",
                )}
              >
                <p className="text-sm font-medium">{message.body}</p>
                <p className={cn("mt-1 text-right text-[10px]", message.mine ? "text-white/60" : "text-faint")}>
                  • {message.sentAt}
                </p>
              </div>
            </li>
          ))}
        </ol>

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
            className="h-[52px] flex-1 rounded-[10px] border border-line-soft bg-canvas px-4 text-sm placeholder:text-line focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim()}
            className="flex h-[52px] w-[100px] items-center justify-center rounded-[10px] bg-navy text-white shadow-card transition-opacity disabled:opacity-60"
          >
            <Send className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </section>
  );
}
