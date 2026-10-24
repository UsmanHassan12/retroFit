"use client";

import { Loader2, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import { BUDGET_RANGES, SERVICE_CATEGORIES } from "../types";

/** Search + category + budget filters. State lives in the URL so results are shareable and SSR'd. */
export function ServiceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const category = searchParams.get("category");
  const budget = searchParams.get("budget");

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(debounce.current), []);

  return (
    <div className="mx-auto grid w-full max-w-[908px] gap-8 px-4">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          update("q", query.trim() || null);
        }}
        className="relative"
      >
        <label htmlFor="service-search" className="sr-only">
          Search retrofit services
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" aria-hidden />
        <input
          id="service-search"
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            clearTimeout(debounce.current);
            debounce.current = setTimeout(() => update("q", value.trim() || null), 300);
          }}
          placeholder="Search retrofit services..."
          className="h-[52px] w-full rounded-[10px] border border-line-soft bg-white pr-12 pl-11 text-sm text-navy shadow-soft placeholder:text-line focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none"
        />
        {isPending ? (
          <Loader2 className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-brand" aria-label="Loading" />
        ) : null}
      </form>

      <FilterGroup label="Category">
        <Chip active={!category} onClick={() => update("category", null)}>
          All Services
        </Chip>
        {SERVICE_CATEGORIES.map((item) => (
          <Chip
            key={item.id}
            active={category === item.id}
            onClick={() => update("category", category === item.id ? null : item.id)}
          >
            {item.label}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label="Budget">
        {BUDGET_RANGES.map((item) => (
          <Chip
            key={item.id}
            active={budget === item.id}
            onClick={() => update("budget", budget === item.id ? null : item.id)}
          >
            {item.label}
          </Chip>
        ))}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3" role="group" aria-label={label}>
      <span className="mr-1 text-xs font-semibold tracking-[0.05em] text-navy uppercase">{label}:</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-[38px] rounded-full border px-6 text-sm font-medium transition-colors",
        active
          ? "border-brand bg-brand text-white shadow-[0_4px_10px_-4px_rgb(18_177_78/0.6)]"
          : "border-line-soft bg-white text-muted hover:border-brand/50 hover:text-navy",
      )}
    >
      {children}
    </button>
  );
}
