import { cn } from "@/lib/utils";

type ProgressProps = {
  value: number;
  tone?: "brand" | "danger";
  /** Visible label above the bar. */
  label?: string;
  /** Accessible name when no visible label is shown. */
  ariaLabel?: string;
  showValue?: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function Progress({
  value,
  tone = "brand",
  label,
  ariaLabel,
  showValue = false,
  size = "md",
  className,
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("grid gap-2", className)}>
      {label || showValue ? (
        <div className="flex items-center justify-between text-sm">
          {label ? <span className="text-muted">{label}</span> : <span />}
          {showValue ? (
            <span className={cn("font-semibold", tone === "danger" ? "text-danger" : "text-brand")}>
              {clamped}%
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? ariaLabel ?? "Progress"}
        className={cn("w-full overflow-hidden rounded-full bg-[#e6e6e6]", size === "sm" ? "h-1.5" : "h-2")}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", tone === "danger" ? "bg-danger" : "bg-brand")}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
