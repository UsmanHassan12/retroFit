import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Card-wrapped, horizontally scrollable table with the dotted row dividers from the design. */
export function Table({ className, children, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      {/* `relative` keeps absolutely positioned children (sr-only labels in cells) inside the
          scroll box; without it they escape to the page and make the whole page scroll sideways. */}
      <div className="relative overflow-x-auto">
        <table className={cn("w-full min-w-[720px] border-collapse text-left text-sm", className)} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-dotted", className)} {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-dotted border-line transition-colors hover:bg-canvas/60", className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("h-12 px-5 text-sm font-medium whitespace-nowrap text-muted", className)}
      {...props}
    />
  );
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("h-[70px] px-5 align-middle text-navy", className)} {...props} />;
}
