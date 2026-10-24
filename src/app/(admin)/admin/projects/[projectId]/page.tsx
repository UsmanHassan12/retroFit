import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PROJECT_TASKS, TASK_COLUMNS } from "@/features/admin/data";

export const metadata: Metadata = { title: "Task Board" };

export default async function AdminProjectBoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

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
            {projectId}
          </li>
        </ol>
      </nav>
      <h1 className="font-display mt-6 text-[34px] font-bold text-navy sm:text-[40px]">{projectId}</h1>
      <p className="mt-2 text-xl text-muted">High-Efficiency Heat Pump Installation Cluster</p>

      <h2 className="mt-10 text-xl font-semibold text-navy">Task Board</h2>
      {/* Drag-and-drop between columns is a follow-up; columns mirror the PAS 2035 workflow states. */}
      <div className="mt-4 grid grid-flow-col auto-cols-[260px] gap-4 overflow-x-auto pb-4 lg:grid-flow-row lg:grid-cols-4 lg:auto-cols-auto">
        {TASK_COLUMNS.map((column) => {
          const tasks = PROJECT_TASKS.filter((task) => task.column === column);
          return (
            <section key={column} aria-label={`${column} (${tasks.length})`} className="flex min-h-[420px] flex-col rounded-2xl bg-white shadow-card lg:min-h-[490px]">
              <header className="flex items-center justify-between border-b border-line-soft px-4 py-5">
                <h3 className="text-xs font-semibold text-navy">{column}</h3>
                <span className="text-base text-brand">({tasks.length})</span>
              </header>
              <ul className="grid content-start gap-3 p-4">
                {tasks.map((task) => (
                  <li key={task.id} className="rounded-xl border border-line-soft bg-white p-3 transition-shadow hover:shadow-soft">
                    <p className="text-base text-navy">{task.title}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {task.tags.map((tag) => (
                        <Badge key={tag} tone={tag === "Done" ? "success" : "neutral"} className="rounded-md px-2 py-1 text-[10px] normal-case tracking-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
