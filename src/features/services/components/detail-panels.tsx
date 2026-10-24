import { BadgeCheck, CircleCheck, ClipboardCheck, FileCheck2, ShieldCheck } from "lucide-react";

import { MilestoneList } from "@/components/ui/milestones";

import type { Service } from "../types";

/** Server-rendered tab panels for the service detail page. */

export function OverviewPanel({ service }: { service: Service }) {
  return (
    <div className="max-w-[880px] text-base leading-6 text-muted">
      <h2 className="text-[30px] font-semibold tracking-tight text-navy">Service Overview</h2>
      {service.overview.paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 32)} className="mt-6">
          {paragraph}
        </p>
      ))}
      <p className="mt-6">Key areas assessed include:</p>
      <ul className="mt-4 list-disc space-y-1 pl-5 marker:text-navy">
        {service.overview.keyAreas.map((area) => (
          <li key={area}>{area}</li>
        ))}
      </ul>
    </div>
  );
}

export function IncludedPanel({ service }: { service: Service }) {
  return (
    <div>
      <h2 className="text-[30px] font-semibold tracking-tight text-navy">Project Deliverables</h2>
      <ul className="mt-6 grid gap-4">
        {service.included.map((item) => (
          <li key={item} className="flex items-center gap-4 text-base text-muted">
            <CircleCheck className="size-5 shrink-0 fill-brand text-white" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TimelinePanel({ service }: { service: Service }) {
  return (
    <div>
      <h2 className="text-[30px] font-semibold tracking-tight text-navy">Milestone Timeline</h2>
      <MilestoneList
        className="mt-6"
        items={service.timeline.map((step, index) => ({
          title: step.title,
          description: step.description,
          status: index === 0 ? "done" : index === 1 ? "current" : "upcoming",
        }))}
        numbered
      />
    </div>
  );
}

const COMPLIANCE_ICONS = {
  audit: ClipboardCheck,
  shield: ShieldCheck,
  badge: BadgeCheck,
  file: FileCheck2,
} as const;

export function CompliancePanel({ service }: { service: Service }) {
  return (
    <div>
      <h2 className="sr-only">Compliance</h2>
      <ul className="grid gap-6 md:grid-cols-2">
        {service.compliance.map((item) => {
          const Icon = COMPLIANCE_ICONS[item.icon];
          return (
            <li key={item.title} className="rounded-2xl border border-line-soft bg-white p-6 shadow-card">
              <h3 className="flex items-center gap-4 text-base font-semibold text-navy">
                <Icon className="size-7 text-brand" strokeWidth={1.8} aria-hidden />
                {item.title}
              </h3>
              <p className="mt-5 text-sm leading-[1.5] text-muted sm:text-base">{item.description}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
