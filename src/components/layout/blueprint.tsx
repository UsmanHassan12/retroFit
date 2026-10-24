import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * The marketing pages sit on a "blueprint" grid: dashed horizontal rules across the page
 * and dashed vertical rules on the content column, with small square markers at corners.
 */

export function Corner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute z-10 size-[6px] border border-line bg-canvas", className)}
    />
  );
}

type BlueprintSectionProps = ComponentProps<"section"> & {
  /** Classes for the inner 1092px content column. */
  innerClassName?: string;
  corners?: boolean;
  bordered?: boolean;
};

export function BlueprintSection({
  className,
  innerClassName,
  corners = true,
  bordered = true,
  children,
  ...props
}: BlueprintSectionProps) {
  return (
    <section className={cn(bordered && "border-blueprint border-b", className)} {...props}>
      <div
        className={cn(
          "relative mx-auto w-full max-w-[1092px] border-blueprint lg:border-x",
          innerClassName,
        )}
      >
        {corners ? (
          <>
            <Corner className="-top-[3px] -left-[3px] hidden lg:block" />
            <Corner className="-top-[3px] -right-[3px] hidden lg:block" />
          </>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** Eyebrow + heading block used to introduce marketing sections. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  as: Heading = "h2",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className={cn("mx-auto max-w-3xl px-4 text-center", className)}>
      {eyebrow ? <p className="text-base text-brand-700">{eyebrow}</p> : null}
      <Heading className="mt-3 text-[28px] leading-[1.2] font-semibold tracking-[-0.04em] text-balance text-navy sm:text-4xl">
        {title}
      </Heading>
      {description ? <p className="mt-4 text-lg text-subtle">{description}</p> : null}
    </div>
  );
}
