"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: string; badge?: ReactNode; content: ReactNode };

/**
 * Accessible tabs (WAI-ARIA pattern, arrow-key navigation) with the green "blueprint" underline.
 * Panels are rendered on the server and passed in as `content`, so all copy stays in the HTML for SEO.
 */
export function Tabs({ items, className, listClassName }: { items: TabItem[]; className?: string; listClassName?: string }) {
  const [active, setActive] = useState(items[0]?.id);
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    if (event.key in keys) {
      event.preventDefault();
      const next = (index + keys[event.key]! + items.length) % items.length;
      setActive(items[next]!.id);
      tabRefs.current[next]?.focus();
    }
  }

  return (
    <div className={className}>
      <div className={cn("overflow-x-auto overflow-y-hidden [scrollbar-width:none] sm:overflow-visible [&::-webkit-scrollbar]:hidden", listClassName)}>
        <div role="tablist" className="border-blueprint flex min-w-max border-b sm:grid sm:min-w-0 sm:grid-flow-col sm:auto-cols-fr">
          {items.map((item, index) => {
            const selected = item.id === active;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                id={`${baseId}-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(item.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  "relative flex items-center justify-center gap-2 px-6 py-5 text-lg whitespace-nowrap transition-colors sm:text-xl",
                  selected ? "font-semibold text-navy" : "font-medium text-muted hover:text-navy",
                )}
              >
                {item.label}
                {item.badge}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-6 bottom-0 h-px bg-brand transition-opacity before:absolute before:-top-[2px] before:left-0 before:size-[5px] before:border before:border-brand before:bg-canvas after:absolute after:-top-[2px] after:right-0 after:size-[5px] after:border after:border-brand after:bg-canvas",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
