import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getClientProjects, type ProjectFilter } from "@/features/projects/queries";
import type { ProjectStage } from "@/features/projects/types";
import { cn, firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "My Projects" };

const FILTERS: { id: ProjectFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
];

const STAGE_STYLES: Record<ProjectStage, string> = {
  Assessment: "text-warning",
  Design: "text-navy",
  Coordination: "text-navy",
  Installation: "text-navy",
  Completed: "text-brand",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = firstParam(params.status);
  const filter: ProjectFilter = status === "active" || status === "completed" ? status : "all";
  const q = firstParam(params.q);
  const projects = await getClientProjects(filter, q);

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Your Projects"
        description="Manage and track your ongoing retrofit operations across all locations."
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter projects" className="flex gap-3">
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <Link
                key={item.id}
                href={item.id === "all" ? "/dashboard/projects" : `/dashboard/projects?status=${item.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-[38px] items-center rounded-full border px-6 text-sm transition-colors",
                  active ? "border-brand bg-brand text-white" : "border-line-soft bg-white text-navy hover:border-brand/40",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ButtonLink href="/services" size="lg" className="text-sm">
          <Plus aria-hidden />
          New Project
        </ButtonLink>
      </div>

      {q ? (
        <p className="mt-6 text-sm text-muted">
          Showing results for “<span className="font-semibold text-navy">{q}</span>” ·{" "}
          <Link href="/dashboard/projects" className="text-brand hover:underline">
            Clear search
          </Link>
        </p>
      ) : null}

      <div className="mt-6">
        <Table>
          <THead>
            <tr>
              <TH>Project ID</TH>
              <TH>Location</TH>
              <TH className="w-[260px]">Progress</TH>
              <TH>Status</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {projects.map((project) => (
              <TR key={project.id}>
                <TD className="whitespace-nowrap">{project.id}</TD>
                <TD>
                  {project.address.line1}, {project.address.city}
                </TD>
                <TD>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-semibold text-brand">{project.progress}%</span>
                    <Progress value={project.progress} size="sm" ariaLabel={`${project.id} progress`} className="w-full" />
                  </div>
                </TD>
                <TD className={cn("font-medium", STAGE_STYLES[project.stage])}>{project.stage}</TD>
                <TD className="text-right">
                  <ButtonLink href={`/dashboard/projects/${project.id}`} variant="ocean" size="sm" className="h-[34px] px-4">
                    View
                  </ButtonLink>
                </TD>
              </TR>
            ))}
            {projects.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-16 text-center text-muted">
                  No projects found.
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
