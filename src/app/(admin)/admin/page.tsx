import { CalendarCheck, Clock, Ellipsis, FileText, LineChart as LineChartIcon, Star, Zap } from "lucide-react";
import Link from "next/link";

import { StatCard } from "@/components/dashboard/page-header";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BarChart, DonutChart, LineChart } from "@/features/admin/components/charts";
import { getAdminDashboard } from "@/features/admin/queries";
import { requireStaff } from "@/lib/auth/guards";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "text-danger",
  MEDIUM: "text-warning",
  LOW: "text-muted",
  QA_REJECT: "text-[#e8590c]",
};

export default async function AdminDashboardPage() {
  const session = await requireStaff();
  const { stats, workload, projectStatus, revenueTrend, priorityQueue } = await getAdminDashboard();

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="relative">
        <WelcomeBanner
          name={session.firstName}
          highlight={`${priorityQueue.length} priority project${priorityQueue.length === 1 ? "" : "s"}`}
          suffix="that require attention today."
        />
        <div className="relative -mt-24 grid grid-cols-2 gap-4 sm:-mt-[66px] lg:grid-cols-3 lg:gap-6">
          <StatCard icon={<FileText />} value={String(stats.newToday)} label="New Today" />
          <StatCard icon={<CalendarCheck />} value={String(stats.activeProjects)} label="Active Projects" />
          <StatCard icon={<Clock />} value={String(stats.overdueTasks)} label="Overdue Tasks" tone="danger" />
          {stats.revenueMtd !== null ? <StatCard icon={<Star />} value={formatPrice(stats.revenueMtd)} label="Revenue MTD" /> : null}
          <StatCard icon={<LineChartIcon />} value={stats.avgCompletionDays === null ? "—" : `${stats.avgCompletionDays}d`} label="Avg Completion" />
          <StatCard icon={<Zap />} value={`${stats.compliancePercent}%`} label="Compliance" />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_473px]">
        <ChartCard title="Team Workload">
          <BarChart data={workload} />
        </ChartCard>
        <ChartCard title="Projects by Status">
          <DonutChart segments={projectStatus.segments} total={projectStatus.total} />
        </ChartCard>
      </div>

      {revenueTrend ? (
        <div className="mt-6">
          <ChartCard title="Revenue Trend">
            <LineChart {...revenueTrend} />
          </ChartCard>
        </div>
      ) : null}

      <section aria-labelledby="priority-queue" className="mt-10">
        <h2 id="priority-queue" className="text-2xl font-semibold text-navy">
          Priority Queue
        </h2>
        <div className="mt-8">
          <Table className="text-[13px]">
            <THead>
              <tr>
                <TH>Project ID</TH>
                <TH>Property</TH>
                <TH>Issue</TH>
                <TH>Due Date</TH>
                <TH>Priority</TH>
                <TH>Assigned To</TH>
                <TH>Action</TH>
              </tr>
            </THead>
            <TBody>
              {priorityQueue.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-10 text-center text-muted">
                    Nothing needs attention right now.
                  </TD>
                </TR>
              ) : null}
              {priorityQueue.map((item) => (
                <TR key={item.reference}>
                  <TD className="whitespace-nowrap">{item.reference}</TD>
                  <TD>{item.property}</TD>
                  <TD>{item.issue}</TD>
                  <TD className="whitespace-nowrap">{item.dueDate ? formatDate(item.dueDate) : "—"}</TD>
                  <TD className={cn("font-medium", PRIORITY_STYLES[item.priority])}>{item.priorityLabel}</TD>
                  <TD className={item.assignee ? undefined : "text-faint"}>{item.assignee?.name ?? "Unassigned"}</TD>
                  <TD>
                    <Link
                      href={`/admin/projects/${item.reference}`}
                      className={buttonVariants({ variant: "ocean", size: "sm", className: "h-[33px] w-[71px] px-0" })}
                    >
                      {item.priority === "QA_REJECT" ? "Review" : item.assignee ? "Open" : "Assign"}
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between border-b border-line-soft pb-4">
        <h2 className="text-lg font-medium text-navy">{title}</h2>
        <Ellipsis className="size-5 text-navy" aria-hidden />
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}
