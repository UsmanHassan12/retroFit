import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,box-shadow,opacity,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0";

const variants = {
  /** Navy → teal gradient — primary actions (View Details, Start Project, Open Project). */
  primary: "bg-brand-gradient text-white shadow-card hover:opacity-95 hover:shadow-float",
  /** Solid green — confirmations (Save, Send Invite, Download Report, Apply). */
  brand: "bg-brand text-white shadow-card hover:bg-brand-600",
  /** Solid navy — Login, chat send, table actions. */
  dark: "bg-navy text-white hover:bg-navy-800",
  /** Solid ocean — compact table actions (View, Assign, PDF). */
  ocean: "bg-[#0b3a5c] text-white hover:bg-ocean",
  /** White pill with soft shadow — secondary actions. */
  outline: "border border-line-soft bg-white text-navy shadow-card hover:bg-canvas",
  /** Bordered, no shadow. */
  ghost: "border border-line bg-white text-navy hover:bg-canvas",
  /** Frosted button for dark/photo backgrounds. */
  glass: "border border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20",
  link: "h-auto px-0 text-brand underline-offset-4 hover:underline",
} as const;

const sizes = {
  sm: "h-9 rounded-lg px-4 text-sm",
  md: "h-11 rounded-[10px] px-5 text-sm",
  lg: "h-12 rounded-xl px-6 text-base",
  xl: "h-14 rounded-xl px-8 text-base",
  icon: "size-10 rounded-full",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

type VariantProps = { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean };

/** Class builder so links and buttons share exactly the same styling. */
export function buttonVariants({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: VariantProps & { className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  ...props
}: ComponentProps<typeof Link> & VariantProps) {
  return <Link className={buttonVariants({ variant, size, fullWidth, className })} {...props} />;
}
