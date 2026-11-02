import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectControls } from "@/features/admin/components/project-controls";
import { TaskBoard } from "@/features/admin/components/task-board";
import { getProjectBoard, getStaffOptions, PRIORITY_LABELS, STATUS_LABELS } from "@/features/admin/queries";
import { requireStaff } from "@/lib/auth/guards";
import { PHASE_LABELS, PRIORITIES, PROJECT_PHASES, PROJECT_STATUSES } from "@/server/domain";
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
        {project.service.title}
      </p>

      <ProjectControls
        reference={project.reference}
        values={{
          phase: project.phase,
          status: project.status,
          priority: project.priority,
          coordinatorId: project.coordinator?.id ?? "",
          dueDate: project.dueDate?.slice(0, 10) ?? "",
          issueSummary: project.issueSummary ?? "",
          criticalIssue: project.criticalIssue,
          phaseNotice: project.phaseNotice ?? "",
        }}
        phases={PROJECT_PHASES.map((phase) => ({ value: phase, label: PHASE_LABELS[phase] }))}
        statuses={PROJECT_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] ?? status }))}
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
