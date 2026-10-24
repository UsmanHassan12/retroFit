import { CalendarCheck, Clock, Ellipsis, FileText, LineChart as LineChartIcon, Star, Zap } from "lucide-react";
import Link from "next/link";

import { StatCard } from "@/components/dashboard/page-header";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { buttonVariants } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BarChart, DonutChart, LineChart } from "@/features/admin/components/charts";
import {
  ADMIN_STATS,
  PRIORITY_QUEUE,
  PROJECT_STATUS,
  PROJECT_TOTAL,
  REVENUE_TREND,
  TEAM_WORKLOAD,
  type Priority,
} from "@/features/admin/data";
import { requireStaff } from "@/lib/auth/guards";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<Priority, string> = {
  High: "text-danger",
  Medium: "text-warning",
  "QA Reject": "text-[#e8590c]",
};

export default async function AdminDashboardPage() {
  const session = await requireStaff();
  const firstName = session.name.split(" ")[0] ?? session.name;

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="relative">
        <WelcomeBanner name={firstName} highlight={`${ADMIN_STATS.newToday} pending projects`} suffix="that require attention today." />
        <div className="relative -mt-24 grid grid-cols-2 gap-4 sm:-mt-[66px] lg:grid-cols-3 lg:gap-6">
          <StatCard icon={<FileText />} value={String(ADMIN_STATS.newToday)} label="New Today" />
          <StatCard icon={<CalendarCheck />} value={String(ADMIN_STATS.activeProjects)} label="Active Projects" />
          <StatCard icon={<Clock />} value={String(ADMIN_STATS.overdueTasks)} label="Overdue Tasks" tone="danger" />
          <StatCard icon={<Star />} value={formatPrice(ADMIN_STATS.revenueMtd)} label="Revenue MTD" />
          <StatCard icon={<LineChartIcon />} value={`${ADMIN_STATS.avgCompletionDays}d`} label="Avg Completion" />
          <StatCard icon={<Zap />} value={`${ADMIN_STATS.compliance}%`} label="Compliance" />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_473px]">
        <ChartCard title="Team Workload">
          <BarChart data={TEAM_WORKLOAD} />
        </ChartCard>
        <ChartCard title="Projects by Status">
          <DonutChart segments={PROJECT_STATUS} total={PROJECT_TOTAL} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard title="Revenue Trend">
          <LineChart {...REVENUE_TREND} />
        </ChartCard>
      </div>

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
              {PRIORITY_QUEUE.map((item) => (
                <TR key={item.id}>
                  <TD className="whitespace-nowrap">{item.id}</TD>
                  <TD>{item.property}</TD>
                  <TD>{item.issue}</TD>
                  <TD className="whitespace-nowrap">{formatDate(item.due)}</TD>
                  <TD className={cn("font-medium", PRIORITY_STYLES[item.priority])}>{item.priority}</TD>
                  <TD className={item.assignee ? undefined : "text-faint"}>{item.assignee ?? "Unassigned"}</TD>
                  <TD>
                    <Link
                      href="/admin/projects/RET-2026-0042"
                      className={buttonVariants({ variant: "ocean", size: "sm", className: "h-[33px] w-[71px] px-0" })}
                    >
                      {item.priority === "QA Reject" ? "Review" : "Assign"}
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
        <button type="button" aria-label={`${title} options`} className="rounded p-1 text-navy hover:bg-canvas">
          <Ellipsis className="size-5" aria-hidden />
        </button>
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}
