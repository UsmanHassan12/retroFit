import { CircleCheck, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { AvatarStack } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ADMIN_PROJECTS, STAFF } from "@/features/admin/data";
import { formatDate } from "@/lib/format";
import { cn, firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects Directory" };

const STATUSES = ["In Progress", "Delayed", "Planning", "Completed"] as const;

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = firstParam(params.status);
  const assignee = firstParam(params.assignee);
  const q = firstParam(params.q)?.toLowerCase();
  const issuesOnly = firstParam(params.issues) === "on";

  const projects = ADMIN_PROJECTS.filter((project) => {
    if (status && project.status !== status) return false;
    if (assignee && !project.team.some((member) => member.name === assignee)) return false;
    if (issuesOnly && project.status !== "Delayed") return false;
    if (q && !`${project.id} ${project.client.name} ${project.address} ${project.service}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const activeFilters = [status && `Status: ${status}`, assignee && `Assigned: ${assignee}`, issuesOnly && "Has issues", q && `Search: ${q}`].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title="Projects Directory" description="Manage, filter, and track all active retrofit projects." />

      {/* Plain GET form: filters live in the URL and work without JavaScript. */}
      <form className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" action="/admin/projects">
        <FilterCard label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
        </FilterCard>
        <FilterCard label="Assigned To" htmlFor="assignee">
          <Select id="assignee" name="assignee" defaultValue={assignee ?? ""}>
            <option value="">Anyone</option>
            {["Mila Novak", "Rob Clarke", "Jane Doe", "Aron Patel", ...STAFF.map((user) => user.name)]
              .filter((name, index, all) => all.indexOf(name) === index)
              .map((name) => (
                <option key={name}>{name}</option>
              ))}
          </Select>
        </FilterCard>
        <FilterCard label="Date Range" htmlFor="range">
          <Select id="range" name="range" defaultValue={firstParam(params.range) ?? "q4-2026"}>
            <option value="q4-2026">Q4 2026</option>
            <option value="q3-2026">Q3 2026</option>
            <option value="ytd">Year to date</option>
          </Select>
        </FilterCard>
        <FilterCard label="Has Issues" htmlFor="issues">
          <label className="flex h-12 items-center justify-between rounded-[10px] border border-line-soft px-4 text-sm text-navy">
            Critical only
            <input id="issues" type="checkbox" name="issues" defaultChecked={issuesOnly} className="size-4 accent-brand" />
          </label>
        </FilterCard>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
          <Button type="submit" variant="ocean" size="sm">
            Apply filters
          </Button>
          {activeFilters.length ? (
            <>
              <span className="text-sm text-muted">Active filters:</span>
              {activeFilters.map((filter) => (
                <span key={filter} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-navy shadow-card">
                  {filter}
                </span>
              ))}
              <Link href="/admin/projects" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                <X className="size-3.5" aria-hidden />
                Clear all
              </Link>
            </>
          ) : null}
        </div>
      </form>

      <div className="mt-8">
        <Table className="min-w-[1240px]">
          <THead>
            <tr>
              <TH className="w-12">
                <span className="sr-only">Verified</span>
              </TH>
              <TH>Project ID</TH>
              <TH>Client</TH>
              <TH>Address</TH>
              <TH>Service</TH>
              <TH className="w-[150px]">Progress</TH>
              <TH>Team</TH>
              <TH>Status</TH>
              <TH>Due</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {projects.map((project) => {
              const delayed = project.status === "Delayed";
              return (
                <TR key={project.id}>
                  <TD>
                    <CircleCheck
                      className={cn("size-5 text-brand", project.verified && "fill-brand text-white")}
                      aria-label={project.verified ? "Documents verified" : "Awaiting verification"}
                    />
                  </TD>
                  <TD className="whitespace-nowrap">{project.id}</TD>
                  <TD>
                    <p>{project.client.name}</p>
                    <p className="text-xs text-muted">{project.client.email}</p>
                  </TD>
                  <TD className="whitespace-nowrap">{project.address}</TD>
                  <TD className="whitespace-nowrap">{project.service}</TD>
                  <TD>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn("text-xs font-semibold", delayed ? "text-danger" : "text-brand")}>{project.progress}%</span>
                      <Progress value={project.progress} size="sm" tone={delayed ? "danger" : "brand"} ariaLabel={`${project.id} progress`} className="w-full" />
                    </div>
                  </TD>
                  <TD>
                    <AvatarStack people={project.team} max={2} />
                  </TD>
                  <TD className={cn("whitespace-nowrap", delayed ? "text-danger" : "text-brand")}>{project.status}</TD>
                  <TD className="whitespace-nowrap">{formatDate(project.due)}</TD>
                  <TD>
                    <Link href={`/admin/projects/${project.id}`} className={buttonVariants({ variant: "ocean", size: "sm", className: "h-[34px]" })}>
                      View
                    </Link>
                  </TD>
                </TR>
              );
            })}
            {projects.length === 0 ? (
              <TR>
                <TD colSpan={10} className="py-16 text-center text-muted">
                  No projects match these filters.
                </TD>
              </TR>
            ) : null}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function FilterCard({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-card">
      <label htmlFor={htmlFor} className="mb-3 block text-xs font-semibold tracking-[0.05em] text-navy uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}
