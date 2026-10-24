import { ChevronLeft } from "lucide-react";
import Link from "next/link";

const STEPS = ["Review", "Payment", "Confirmation"] as const;

export function CheckoutHeader({
  title,
  backHref,
  backLabel,
  step,
}: {
  title: string;
  backHref: string;
  backLabel: string;
  step: 1 | 2 | 3;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 px-4 pt-14 pb-12 sm:px-6">
      <div>
        <Link href={backHref} className="inline-flex items-center gap-1 text-base text-muted transition-colors hover:text-navy">
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel}
        </Link>
        <h1 className="font-display mt-8 text-3xl font-bold text-navy">{title}</h1>
      </div>
      <ol className="flex items-center gap-3 text-xs font-medium" aria-label="Checkout progress">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const state = number < step ? "done" : number === step ? "current" : "todo";
          return (
            <li key={label} className="flex items-center gap-3" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={
                  state === "todo"
                    ? "flex size-6 items-center justify-center rounded-full border border-line text-faint"
                    : "flex size-6 items-center justify-center rounded-full bg-brand text-white"
                }
              >
                {number}
              </span>
              <span className={state === "todo" ? "text-faint" : "text-navy"}>{label}</span>
              {number < STEPS.length ? <span aria-hidden className="h-px w-6 bg-line" /> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
