import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const tones = {
  /** Mint pill with green text — ECO4, VERIFIED, PREMIUM TIER, Done. */
  success: "bg-brand-100/80 text-brand-700",
  /** Solid green — PAS 2035, FUNDING, TrustMark Certified on photos. */
  brand: "bg-brand text-white",
  /** Outlined green — "All Services" eyebrow. */
  outline: "border border-brand/40 bg-white text-brand",
  neutral: "bg-canvas text-muted",
  warning: "bg-warning-soft text-[#9a6b00]",
  danger: "bg-danger/10 text-danger",
  dark: "bg-navy text-white",
} as const;

type BadgeProps = ComponentProps<"span"> & { tone?: keyof typeof tones; dot?: boolean };

export function Badge({ tone = "success", dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] leading-none font-semibold tracking-[0.05em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
