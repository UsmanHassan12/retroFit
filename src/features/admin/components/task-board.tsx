"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export type BoardTask = { id: string; title: string; tags: string[]; visibleToClient: boolean; assignee: string | null; overdue: boolean };
export type BoardColumn = { key: string; label: string; tasks: BoardTask[] };

/**
 * Task board. Drag a card between columns (or use its "Move to" menu — the keyboard-friendly
 * equivalent). Changes are applied optimistically and saved through /api/admin/tasks.
 */
export function TaskBoard({ projectRef, initialColumns }: { projectRef: string; initialColumns: BoardColumn[] }) {
  const router = useRouter();
  const [columns, setColumns] = useState(initialColumns);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const findTask = (id: string) => {
    for (const column of columns) {
      const task = column.tasks.find((item) => item.id === id);
      if (task) return { task, column: column.key };
    }
    return null;
  };

  async function move(taskId: string, target: string, position?: number) {
    const found = findTask(taskId);
    if (!found) return;
    const previous = columns;
    const targetTasks = columns.find((column) => column.key === target)?.tasks.filter((task) => task.id !== taskId) ?? [];
    const index = Math.min(position ?? targetTasks.length, targetTasks.length);
    if (found.column === target && (position === undefined || columns.find((c) => c.key === target)?.tasks[index]?.id === taskId)) return;

    setColumns((current) =>
      current.map((column) => {
        const without = column.tasks.filter((task) => task.id !== taskId);
        if (column.key !== target) return { ...column, tasks: without };
        const next = [...without];
        next.splice(index, 0, { ...found.task, tags: target === "DONE" ? [...new Set([...found.task.tags, "Done"])] : found.task.tags });
        return { ...column, tasks: next };
      }),
    );
    setError(null);
    try {
      await api(`/api/admin/tasks/${taskId}`, { method: "PATCH", json: { column: target, position: index } });
      router.refresh();
    } catch (caught) {
      setColumns(previous);
      setError(caught instanceof Error ? caught.message : "Couldn’t move the task.");
    }
  }

  async function add(column: string, title: string) {
    setAdding(column);
    setError(null);
    try {
      const task = await api<{ id: string; title: string; tags: string[]; visibleToClient: boolean }>(
        `/api/admin/projects/${encodeURIComponent(projectRef)}/board`,
        { method: "POST", json: { title, column, visibleToClient: column === "AWAITING_CLIENT", tags: column === "AWAITING_CLIENT" ? ["Client"] : [] } },
      );
      setColumns((current) =>
        current.map((item) => (item.key === column ? { ...item, tasks: [...item.tasks, { ...task, assignee: null, overdue: false }] } : item)),
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t add the task.");
    } finally {
      setAdding(null);
    }
  }

  async function remove(taskId: string) {
    const previous = columns;
    setColumns((current) => current.map((column) => ({ ...column, tasks: column.tasks.filter((task) => task.id !== taskId) })));
    try {
      await api(`/api/admin/tasks/${taskId}`, { method: "DELETE" });
      router.refresh();
    } catch (caught) {
      setColumns(previous);
      setError(caught instanceof Error ? caught.message : "Couldn’t delete the task.");
    }
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid auto-cols-[260px] grid-flow-col gap-4 overflow-x-auto pb-4 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-4">
        {columns.map((column) => (
          <section
            key={column.key}
            aria-label={`${column.label} (${column.tasks.length})`}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(column.key);
            }}
            onDragLeave={() => setOver((value) => (value === column.key ? null : value))}
            onDrop={(event) => {
              event.preventDefault();
              setOver(null);
              const id = event.dataTransfer.getData("text/plain") || dragging;
              if (id) void move(id, column.key);
              setDragging(null);
            }}
            className={cn(
              "flex min-h-[420px] flex-col rounded-2xl bg-white shadow-card transition-shadow lg:min-h-[490px]",
              over === column.key && "ring-2 ring-brand/50",
            )}
          >
            <header className="flex items-center justify-between border-b border-line-soft px-4 py-5">
              <h3 className="text-xs font-semibold text-navy">{column.label}</h3>
              <span className="text-base text-brand">({column.tasks.length})</span>
            </header>
            <ul className="grid flex-1 content-start gap-3 p-4">
              {column.tasks.map((task) => (
                <li
                  key={task.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/plain", task.id);
                    event.dataTransfer.effectAllowed = "move";
                    setDragging(task.id);
                  }}
                  onDragEnd={() => setDragging(null)}
                  className={cn(
                    "group cursor-grab rounded-xl border border-line-soft bg-white p-3 transition-shadow hover:shadow-soft active:cursor-grabbing",
                    dragging === task.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base text-navy">{task.title}</p>
                    <button
                      type="button"
                      onClick={() => remove(task.id)}
                      aria-label={`Delete task ${task.title}`}
                      className="rounded p-1 text-faint opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                  {task.assignee ? <p className="mt-1 text-xs text-muted">{task.assignee}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {task.overdue ? (
                      <Badge tone="danger" className="rounded-md px-2 py-1 text-[10px] tracking-normal normal-case">
                        Overdue
                      </Badge>
                    ) : null}
                    {task.visibleToClient ? (
                      <Badge tone="outline" className="rounded-md px-2 py-1 text-[10px] tracking-normal normal-case">
                        Client
                      </Badge>
                    ) : null}
                    {task.tags
                      .filter((tag) => !(tag === "Client" && task.visibleToClient))
                      .map((tag) => (
                        <Badge key={tag} tone={tag === "Done" ? "success" : "neutral"} className="rounded-md px-2 py-1 text-[10px] tracking-normal normal-case">
                          {tag}
                        </Badge>
                      ))}
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-[11px] text-muted">
                    Move to
                    <select
                      value={column.key}
                      onChange={(event) => move(task.id, event.target.value)}
                      className="rounded border border-line-soft bg-white px-1.5 py-0.5 text-[11px] text-navy"
                    >
                      {columns.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2 border-t border-line-soft p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.elements.namedItem("title") as HTMLInputElement;
                const title = input.value.trim();
                if (title.length < 2) return;
                input.value = "";
                void add(column.key, title);
              }}
            >
              <label htmlFor={`add-${column.key}`} className="sr-only">
                Add a task to {column.label}
              </label>
              <input
                id={`add-${column.key}`}
                name="title"
                placeholder="Add a task…"
                maxLength={140}
                className="min-w-0 flex-1 rounded-lg border border-line-soft px-2.5 py-1.5 text-sm text-navy placeholder:text-faint focus-visible:border-brand focus-visible:outline-none"
              />
              <button type="submit" aria-label={`Add task to ${column.label}`} className="rounded-lg bg-navy px-2 text-white disabled:opacity-60" disabled={adding === column.key}>
                {adding === column.key ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              </button>
            </form>
          </section>
        ))}
      </div>
    </>
  );
}
