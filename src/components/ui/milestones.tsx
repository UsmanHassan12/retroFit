import { CircleCheck, Clock } from "lucide-react";

import { cn } from "@/lib/utils";

export type MilestoneStatus = "done" | "current" | "upcoming";

export type MilestoneItem = {
  title: string;
  description?: string;
  date?: string;
  status: MilestoneStatus;
};

/**
 * Vertical milestone timeline.
 * `numbered` shows step numbers (service detail); otherwise status icons (project timeline).
 */
export function MilestoneList({
  items,
  numbered = false,
  className,
}: {
  items: MilestoneItem[];
  numbered?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("grid", className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        const nextDone = items[index + 1]?.status === "done";
        return (
          <li key={item.title} className="relative flex gap-4 pb-10 last:pb-0" aria-current={item.status === "current" ? "step" : undefined}>
            {!last ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 bottom-1 left-[11.5px] w-0.5",
                  item.status === "done" && (nextDone || !numbered) ? "bg-brand" : "bg-[#c4c4c4]",
                )}
              />
            ) : null}
            <StatusDot status={item.status} number={numbered ? index + 1 : undefined} />
            <div className="-mt-0.5">
              <p
                className={cn(
                  "text-base font-semibold",
                  item.status === "upcoming" && !numbered ? "text-line" : "text-navy",
                )}
              >
                {item.title}
                {item.status === "current" && !numbered ? (
                  <span className="ml-1 align-middle text-[10px] font-normal text-warning">(Current)</span>
                ) : null}
              </p>
              {item.description ? <p className="mt-2 text-sm text-muted">{item.description}</p> : null}
              {item.date ? <p className="mt-2 text-xs text-faint">{item.date}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusDot({ status, number }: { status: MilestoneStatus; number?: number }) {
  if (status === "done") {
    return <CircleCheck className="relative size-6 shrink-0 rounded-full bg-brand p-1 text-white" aria-label="Completed" />;
  }
  if (number !== undefined) {
    return (
      <span
        className={cn(
          "relative flex size-6 shrink-0 items-center justify-center rounded-full border-2 bg-canvas text-[11px] font-bold",
          status === "current" ? "border-brand text-brand" : "border-[#c4c4c4] text-line",
        )}
      >
        {number}
      </span>
    );
  }
  return (
    <Clock
      className={cn(
        "relative size-6 shrink-0 rounded-full p-1 text-white",
        status === "current" ? "bg-warning" : "bg-[#c4c4c4]",
      )}
      aria-label={status === "current" ? "In progress" : "Upcoming"}
    />
  );
}
