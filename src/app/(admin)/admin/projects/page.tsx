import { CircleCheck, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { AvatarStack } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getAdminProjects, getStaffOptions, STATUS_LABELS } from "@/features/admin/queries";
import { formatDate } from "@/lib/format";
import { cn, firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects Directory" };

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "ON_TRACK", label: "On Track" },
  { value: "AT_RISK", label: "At Risk" },
  { value: "DELAYED", label: "Delayed" },
  { value: "AWAITING_INFO", label: "Awaiting information" },
  { value: "SCHEDULED", label: "Visit scheduled" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "IN_QA", label: "Quality check" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "ON_HOLD", label: "On hold" },
  { value: "completed", label: "Completed" },
];

const RANGES = [
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "365d", label: "Last 12 months", days: 365 },
];

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = firstParam(params.status) ?? "";
  const assignee = firstParam(params.assignee) ?? "";
  const range = firstParam(params.range) ?? "";
  const q = firstParam(params.q) ?? "";
  const issuesOnly = firstParam(params.issues) === "on";
  const page = Math.max(1, Number(firstParam(params.page)) || 1);
  const days = RANGES.find((item) => item.value === range)?.days;

  const [result, staff] = await Promise.all([
    getAdminProjects({
      ...(status ? { status } : {}),
      ...(assignee ? { assignedTo: assignee } : {}),
      ...(days ? { from: new Date(Date.now() - days * 86_400_000).toISOString() } : {}),
      ...(issuesOnly ? { criticalOnly: "true" } : {}),
      ...(q ? { q } : {}),
      page: String(page),
    }),
    getStaffOptions(),
  ]);
  const { projects, total, pageSize } = result;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const assigneeName = staff.find((member) => member.id === assignee)?.name;
  const activeFilters = [
    status && `Status: ${STATUSES.find((item) => item.value === status)?.label ?? status}`,
    assigneeName && `Assigned: ${assigneeName}`,
    days && RANGES.find((item) => item.value === range)?.label,
    issuesOnly && "Critical only",
    q && `Search: ${q}`,
  ].filter(Boolean) as string[];

  const pageHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ status, assignee, range, q, issues: issuesOnly ? "on" : "" })) if (value) next.set(key, value);
    if (target > 1) next.set("page", String(target));
    const query = next.toString();
    return `/admin/projects${query ? `?${query}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title="Projects Directory" description="Manage, filter, and track all active retrofit projects." />

      {/* Plain GET form: filters live in the URL and work without JavaScript. */}
      <form className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" action="/admin/projects">
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <FilterCard label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </FilterCard>
        <FilterCard label="Assigned To" htmlFor="assignee">
          <Select id="assignee" name="assignee" defaultValue={assignee}>
            <option value="">Anyone</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </FilterCard>
        <FilterCard label="Date Range" htmlFor="range">
          <Select id="range" name="range" defaultValue={range}>
            <option value="">Any time</option>
            {RANGES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </FilterCard>
        <FilterCard label="Has Issues" htmlFor="issues">
          <label className="flex h-12 items-center justify-between rounded-[10px] border border-line-soft px-4 text-sm text-navy">
            Critical only
            <input id="issues" type="checkbox" name="issues" defaultChecked={issuesOnly} className="size-4 accent-brand" />
          </label>
        </FilterCard>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
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
          <span className="ml-auto text-sm text-muted">
            {total} project{total === 1 ? "" : "s"}
          </span>
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
              const late = project.health === "DELAYED" || project.health === "AT_RISK" || project.status === "ON_HOLD";
              const verified = Boolean(project.property?.verified);
              return (
                <TR key={project.reference}>
                  <TD>
                    <CircleCheck
                      className={cn("size-5 text-brand", verified && "fill-brand text-white")}
                      aria-label={verified ? "Property verified" : "Awaiting verification"}
                    />
                  </TD>
                  <TD className="whitespace-nowrap">{project.reference}</TD>
                  <TD>
                    <p>{project.client?.name}</p>
                    <p className="text-xs text-muted">{project.client?.email}</p>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {project.property ? `${project.property.line1}, ${project.property.city}` : "—"}
                  </TD>
                  <TD className="whitespace-nowrap">{project.service.title}</TD>
                  <TD>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn("text-xs font-semibold", late ? "text-danger" : "text-brand")}>{project.progress}%</span>
                      <Progress value={project.progress} size="sm" tone={late ? "danger" : "brand"} ariaLabel={`${project.reference} progress`} className="w-full" />
                    </div>
                  </TD>
                  <TD>
                    <AvatarStack people={project.team.map((member: { name: string; avatarUrl: string | null }) => ({ name: member.name, src: member.avatarUrl ?? undefined }))} max={2} />
                  </TD>
                  <TD className={cn("whitespace-nowrap", late ? "text-danger" : "text-brand")}>{project.statusLabel}
                    {project.health !== "ON_TRACK" ? <span className="block text-xs">{STATUS_LABELS[project.health] ?? project.health}</span> : null}
                  </TD>
                  <TD className="whitespace-nowrap">{project.dueDate ? formatDate(project.dueDate) : "—"}</TD>
                  <TD>
                    <Link href={`/admin/projects/${project.reference}`} className={buttonVariants({ variant: "ocean", size: "sm", className: "h-[34px]" })}>
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

      {pages > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-end gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Previous
            </Link>
          ) : null}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
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
