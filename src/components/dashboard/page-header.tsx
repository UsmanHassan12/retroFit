import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[34px] leading-[1.15] font-bold tracking-[-0.01em] text-navy sm:text-[40px]">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-[900px] text-lg text-muted sm:text-xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

/** Large stat card used on both dashboards (icon tile, big number, caption). */
export function StatCard({
  icon,
  value,
  label,
  tone = "brand",
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone?: "brand" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-line-soft/70 bg-white p-4 shadow-card sm:p-[17px]">
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#eceef0] text-navy shadow-[0_3px_4px_rgb(11_28_48/0.18)] [&_svg]:size-[18px]">
        {icon}
      </span>
      <p className={cn("mt-4 text-[40px] leading-none font-bold tracking-tight sm:text-[48px]", tone === "danger" ? "text-danger" : "text-brand")}>
        {value}
      </p>
      <p className="mt-4 text-xs font-semibold tracking-[0.06em] text-navy uppercase">{label}</p>
    </div>
  );
}
