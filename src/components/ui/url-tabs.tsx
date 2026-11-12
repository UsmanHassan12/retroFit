"use client";

import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type UrlTab = { href: string; label: string; exact?: boolean; badge?: number; content: ReactNode };

/**
 * Instant tabs that still have real URLs.
 * - All panels are server-rendered into the HTML (SEO, no loading on switch).
 * - Clicking swaps the panel immediately and updates the address bar with history.pushState,
 *   which Next.js syncs into usePathname, so back/forward and deep links keep working.
 * - Each tab is a plain <a href>, so it still navigates if JavaScript hasn't loaded yet.
 * Variants: `plain` (service detail) and `boxed` (dashed frame, project detail).
 */
export function UrlTabs({
  tabs,
  label,
  variant = "plain",
  panelClassName = "pt-10 sm:pt-12",
}: {
  tabs: UrlTab[];
  label: string;
  variant?: "plain" | "boxed";
  panelClassName?: string;
}) {
  const pathname = usePathname();
  const activeHref =
    tabs.find((tab) => (tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)))?.href ?? tabs[0]?.href;

  function onClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    // Let the browser handle new-tab / new-window clicks.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (href !== pathname) window.history.pushState(null, "", href);
  }

  return (
    <div>
      <nav aria-label={label} className={cn(variant === "boxed" && "border-blueprint border pb-9")}>
        <div className="relative overflow-x-auto overflow-y-hidden [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden">
          <ul
            className={cn(
              "border-blueprint flex min-w-max border-b sm:grid sm:min-w-0 sm:auto-cols-fr sm:grid-flow-col",
              variant === "boxed" && "mx-2",
            )}
          >
            {tabs.map((tab) => {
              const active = tab.href === activeHref;
              return (
                <li key={tab.href}>
                  <a
                    href={tab.href}
                    onClick={(event) => onClick(event, tab.href)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center justify-center gap-2 px-6 text-lg whitespace-nowrap transition-colors sm:text-xl",
                      variant === "boxed" ? "h-[72px]" : "h-16",
                      active ? "font-semibold text-navy" : "font-medium text-muted hover:text-navy",
                    )}
                  >
                    {tab.label}
                    {tab.badge ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-semibold text-white">
                        {tab.badge}
                        <span className="sr-only"> unread</span>
                      </span>
                    ) : null}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-4 bottom-0 h-px bg-brand before:absolute before:-top-[2px] before:left-0 before:size-[5px] before:border before:border-brand before:bg-canvas after:absolute after:-top-[2px] after:right-0 after:size-[5px] after:border after:border-brand after:bg-canvas",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {tabs.map((tab) => (
        <section key={tab.href} hidden={tab.href !== activeHref} aria-label={tab.label} className={panelClassName}>
          {tab.content}
        </section>
      ))}
    </div>
  );
}
