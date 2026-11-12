import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectControls } from "@/features/admin/components/project-controls";
import { TaskBoard } from "@/features/admin/components/task-board";
import { getProjectBoard, getStaffOptions, HEALTH_LABELS, PRIORITY_LABELS } from "@/features/admin/queries";
import { requireStaff } from "@/lib/auth/guards";
import { PRIORITIES, PROJECT_HEALTH, PROJECT_STATUS_LABELS, PROJECT_STATUSES } from "@/server/domain";
import { isAppError } from "@/server/errors";

export const metadata: Metadata = { title: "Task Board" };

export default async function AdminProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await requireStaff();

  const data = await getProjectBoard(projectId).catch((error) => {
    if (isAppError(error) && error.code === "NOT_FOUND") return null;
    throw error;
  });
  if (!data) notFound();
  const { board, project } = data;

  const canAssign = session.role === "admin" || session.role === "coordinator";
  const staff = canAssign ? await getStaffOptions() : [];
  const now = Date.now();

  return (
    <div className="mx-auto max-w-[1120px]">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-3 text-sm">
          <li>
            <Link href="/admin/projects" className="text-muted hover:text-navy">
              Projects
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-4" />
          </li>
          <li aria-current="page" className="font-medium text-navy">
            {project.reference}
          </li>
        </ol>
      </nav>
      <h1 className="font-display mt-6 text-[34px] font-bold text-navy sm:text-[40px]">{project.reference}</h1>
      <p className="mt-2 text-xl text-muted">{project.title}</p>
      <p className="mt-2 text-sm text-muted">
        {project.client?.name} · {project.property ? `${project.property.line1}, ${project.property.city} ${project.property.postcode}` : "No property yet"} ·{" "}
        {project.service.title} · <span className="font-semibold text-navy">{project.statusLabel}</span>
        {project.partnerPriority ? <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">Premium Partner</span> : null}
      </p>
      {project.missing.answers.length || project.missing.documents.length ? (
        <p className="mt-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-[#7a5500]">
          Waiting for: {[...project.missing.answers.map((item) => item.label), ...project.missing.documents.map((item) => item.label)].join(", ")}
        </p>
      ) : null}

      <ProjectControls
        reference={project.reference}
        values={{
          stage: String(project.stage?.position ?? 0),
          status: project.status,
          health: project.health,
          priority: project.priority,
          coordinatorId: project.coordinator?.id ?? "",
          dueDate: project.dueDate?.slice(0, 10) ?? "",
          issueSummary: project.issueSummary ?? "",
          criticalIssue: project.criticalIssue,
          phaseNotice: project.phaseNotice ?? "",
        }}
        stages={project.milestones.map((milestone) => ({ value: String(milestone.position), label: `${milestone.position + 1}. ${milestone.title}` }))}
        statuses={PROJECT_STATUSES.filter((status) => status !== "CANCELLED").map((status) => ({ value: status, label: PROJECT_STATUS_LABELS[status] }))}
        healths={PROJECT_HEALTH.map((health) => ({ value: health, label: HEALTH_LABELS[health] ?? health }))}
        priorities={PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] ?? priority }))}
        coordinators={
          canAssign
            ? staff.filter((member) => member.role === "COORDINATOR" || member.role === "ADMIN").map((member) => ({ value: member.id, label: member.name }))
            : null
        }
      />

      <h2 className="mt-10 text-xl font-semibold text-navy">Task Board</h2>
      <p className="mt-1 text-sm text-muted">Drag cards between columns. Tasks in “Awaiting Client” are visible to the client.</p>
      <TaskBoard
        key={board.columns.map((column) => column.tasks.map((task) => `${task.id}:${task.position}`).join()).join("|")}
        projectRef={project.reference}
        initialColumns={board.columns.map((column) => ({
          key: column.key,
          label: column.label,
          tasks: column.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            tags: task.tags,
            visibleToClient: task.visibleToClient,
            assignee: task.assignee?.name ?? null,
            overdue: column.key !== "DONE" && Boolean(task.dueDate && new Date(task.dueDate).getTime() < now),
          })),
        }))}
      />
    </div>
  );
}
