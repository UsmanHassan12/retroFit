"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type RouteTab = { href: string; label: string; badge?: number; exact?: boolean };

/**
 * Tab bar where every tab is a real route: deep-linkable, server-rendered and works without JS.
 * - `boxed`: dashed frame around the bar (project detail).
 * - `plain`: bare underline bar (service detail).
 */
export function RouteTabs({
  tabs,
  label,
  variant = "boxed",
}: {
  tabs: RouteTab[];
  label: string;
  variant?: "boxed" | "plain";
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className={cn(variant === "boxed" && "border-blueprint border pb-9")}>
      {/* Horizontal swipe on small screens only; the scrollbar itself is hidden. */}
      <div className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden">
        <ul
          className={cn(
            "border-blueprint flex min-w-max border-b sm:grid sm:min-w-0 sm:auto-cols-fr sm:grid-flow-col",
            variant === "boxed" && "mx-2",
          )}
        >
          {tabs.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  scroll={false}
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
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
