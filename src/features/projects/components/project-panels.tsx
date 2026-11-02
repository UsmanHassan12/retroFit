import { BadgeCheck, CircleAlert, Download, FileSpreadsheet, FileText, FileType } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { IconTile } from "@/components/ui/card";
import { MilestoneList } from "@/components/ui/milestones";

import type { Project, ProjectDeliverable } from "../types";

import { DocumentActions } from "./document-actions";

/** Server-rendered panels for the project detail tabs (switched instantly by UrlTabs). */

export function ProjectOverviewPanel({ project }: { project: Project }) {
  return (
    <div className="grid gap-8">
      <section>
        <p className="text-sm font-medium text-muted">Current Phase</p>
        <h2 className="mt-1 text-[30px] font-semibold text-navy">{project.phase.name}</h2>
        <p className="mt-6 text-base text-muted">{project.phase.description}</p>
        {project.phase.notice ? (
          <p className="mt-6 flex items-center gap-3 rounded-2xl bg-[#e6e6e6] px-5 py-5 text-base text-brand shadow-card">
            <CircleAlert className="size-5 shrink-0" aria-hidden />
            {project.phase.notice}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="recent-activity" className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
        <h2 id="recent-activity" className="text-base font-semibold text-navy">
          Recent Activity
        </h2>
        {project.activity.length === 0 ? <p className="mt-4 text-sm text-muted">No activity yet.</p> : null}
        <ul className="mt-3">
          {project.activity.map((item) => (
            <li key={item.id} className="flex items-center gap-4 border-b border-dotted border-line py-4 last:border-0">
              <IconTile>
                <BadgeCheck aria-hidden />
              </IconTile>
              <div>
                <p className="text-base text-navy">{item.title}</p>
                <p className="text-sm text-faint">
                  {item.actor} • {item.at}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ProjectDocumentsPanel({ project }: { project: Project }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_323px]">
      <section aria-labelledby="your-documents" className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
        <h2 id="your-documents" className="text-base font-semibold text-navy">
          Your Documents
        </h2>
        {project.documents.length === 0 ? <p className="mt-4 text-sm text-muted">No documents yet. Upload your EPC, floor plans and proof of ownership.</p> : null}
        <ul className="mt-3">
          {project.documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-4 border-b border-dotted border-line py-4 last:border-0">
              <IconTile>
                <FileText aria-hidden />
              </IconTile>
              <div className="flex-1">
                <p className="text-base text-navy">{doc.name}</p>
                <p className="text-sm text-faint">
                  Version {doc.version} • {doc.uploadedAt}
                </p>
              </div>
              <a href={doc.href} className="text-sm font-medium text-brand hover:underline" aria-label={`Download ${doc.name}`}>
                Download
              </a>
            </li>
          ))}
        </ul>
      </section>
      <DocumentActions projectRef={project.id} reportHref={project.deliverables.find((item) => item.available)?.href} />
    </div>
  );
}

export function ProjectTimelinePanel({ project }: { project: Project }) {
  return (
    <section aria-labelledby="milestones">
      <h2 id="milestones" className="text-[26px] font-semibold text-navy">
        Milestone Timeline
      </h2>
      <MilestoneList className="mt-8" items={project.milestones} />
    </section>
  );
}

const DELIVERABLE_ICONS: Record<ProjectDeliverable["kind"], typeof FileText> = {
  pdf: FileType,
  spreadsheet: FileSpreadsheet,
  report: FileText,
};

export function ProjectDeliverablesPanel({ project }: { project: Project }) {
  const buttonClass = buttonVariants({
    variant: "brand",
    size: "lg",
    fullWidth: true,
    className: "mt-6 rounded-[10px] shadow-none",
  });

  return (
    <section aria-labelledby="deliverables">
      <h2 id="deliverables" className="text-[26px] font-semibold text-navy">
        Deliverables (Available after delivery)
      </h2>
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {project.deliverables.map((item) => {
          const Icon = DELIVERABLE_ICONS[item.kind];
          return (
            <li key={item.id} className="flex flex-col rounded-2xl bg-white p-4 shadow-card">
              <IconTile className="size-10">
                <Icon aria-hidden />
              </IconTile>
              <h3 className="mt-6 text-base font-semibold text-navy">{item.title}</h3>
              <p className="mt-2 flex-1 text-xs text-muted">{item.description}</p>
              {item.available && item.href ? (
                <a href={item.href} className={buttonClass}>
                  <Download aria-hidden />
                  Download Report
                </a>
              ) : (
                <span aria-disabled="true" title="Available once the report is delivered" className={buttonClass}>
                  <Download aria-hidden />
                  Download Report
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
