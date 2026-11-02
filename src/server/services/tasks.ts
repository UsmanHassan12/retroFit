import "server-only";

import { z } from "zod";

import { assertStaff, findAccessibleProject, isStaff, projectScope } from "../auth/permissions";
import type { AuthUser } from "../auth/session";
import { db, type Tx } from "../db";
import { notFound } from "../errors";
import { TASK_COLUMN_LABELS, TASK_COLUMNS, type TaskColumn } from "../domain";
import { toPerson } from "./projects";

/**
 * Task board (Backlog → Awaiting Client → Assessment → Design → Coordination → QA → Done).
 * `position` is a dense 0..n-1 index inside each column; moves shift neighbours.
 */

const taskInclude = { assignee: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true } } } as const;

const toTask = (task: any) => ({
  id: task.id as string,
  title: task.title as string,
  description: (task.description as string | null) ?? null,
  column: task.column as TaskColumn,
  position: task.position as number,
  tags: task.tags as string[],
  visibleToClient: task.visibleToClient as boolean,
  assignee: toPerson(task.assignee),
  dueDate: task.dueDate ? (task.dueDate as Date).toISOString() : null,
  completedAt: task.completedAt ? (task.completedAt as Date).toISOString() : null,
});
export type TaskDto = ReturnType<typeof toTask>;

/** GET /api/projects/:ref/tasks — clients see only client-visible tasks. */
export async function listProjectTasks(user: AuthUser, reference: string) {
  const project = await findAccessibleProject(user, reference);
  const tasks = await db.task.findMany({
    where: { projectId: project.id, ...(isStaff(user) ? {} : { visibleToClient: true }) },
    include: taskInclude,
    orderBy: [{ column: "asc" }, { position: "asc" }],
  });
  return tasks.map(toTask);
}

export async function getBoard(user: AuthUser, reference: string) {
  assertStaff(user);
  const project = await findAccessibleProject(user, reference);
  const tasks = await db.task.findMany({ where: { projectId: project.id }, include: taskInclude, orderBy: { position: "asc" } });
  return {
    project: { reference: project.reference, title: project.title },
    columns: TASK_COLUMNS.map((column) => ({
      key: column,
      label: TASK_COLUMN_LABELS[column],
      tasks: tasks.filter((task: any) => task.column === column).map(toTask),
    })),
  };
}

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Give the task a title.").max(140),
  description: z.string().trim().max(2000).optional(),
  column: z.enum(TASK_COLUMNS).default("BACKLOG"),
  tags: z.array(z.string().trim().min(1).max(24)).max(6).default([]),
  visibleToClient: z.boolean().default(false),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({ position: z.number().int().min(0).optional() });

async function assertAssignee(assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  const assignee = await db.user.findFirst({ where: { id: assigneeId, role: { not: "CLIENT" }, status: "ACTIVE" }, select: { id: true } });
  if (!assignee) throw notFound("Assignee");
}

export async function createTask(user: AuthUser, reference: string, input: z.input<typeof createTaskSchema>) {
  assertStaff(user);
  const data = createTaskSchema.parse(input);
  const project = await findAccessibleProject(user, reference);
  await assertAssignee(data.assigneeId);
  const task = await db.$transaction(async (tx) => {
    const position = await tx.task.count({ where: { projectId: project.id, column: data.column } });
    return tx.task.create({
      data: {
        projectId: project.id,
        createdById: user.id,
        ...data,
        position,
        completedAt: data.column === "DONE" ? new Date() : null,
      },
      include: taskInclude,
    });
  });
  return toTask(task);
}

/** Staff may only touch tasks on projects they can see. */
async function accessibleTask(user: AuthUser, id: string) {
  const task = await db.task.findFirst({ where: { id, project: projectScope(user) } });
  if (!task) throw notFound("Task");
  return task;
}

async function closeGap(tx: Tx, projectId: string, column: TaskColumn, from: number) {
  await tx.task.updateMany({ where: { projectId, column, position: { gt: from } }, data: { position: { decrement: 1 } } });
}

export async function updateTask(user: AuthUser, id: string, input: z.input<typeof updateTaskSchema>) {
  assertStaff(user);
  const data = updateTaskSchema.parse(input);
  const task = await accessibleTask(user, id);
  await assertAssignee(data.assigneeId);
  const { position, column, ...fields } = data;

  const updated = await db.$transaction(async (tx) => {
    const targetColumn: TaskColumn = column ?? (task.column as TaskColumn);
    if (column !== undefined || position !== undefined) {
      await closeGap(tx, task.projectId, task.column as TaskColumn, task.position);
      const size = await tx.task.count({ where: { projectId: task.projectId, column: targetColumn, id: { not: task.id } } });
      const target = Math.min(position ?? size, size);
      await tx.task.updateMany({
        where: { projectId: task.projectId, column: targetColumn, position: { gte: target }, id: { not: task.id } },
        data: { position: { increment: 1 } },
      });
      return tx.task.update({
        where: { id: task.id },
        data: {
          ...fields,
          column: targetColumn,
          position: target,
          completedAt: targetColumn === "DONE" ? (task.completedAt ?? new Date()) : null,
        },
        include: taskInclude,
      });
    }
    return tx.task.update({ where: { id: task.id }, data: fields, include: taskInclude });
  });
  return toTask(updated);
}

export async function deleteTask(user: AuthUser, id: string) {
  assertStaff(user);
  const task = await accessibleTask(user, id);
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: task.id } });
    await closeGap(tx, task.projectId, task.column as TaskColumn, task.position);
  });
}

/** Overdue tasks across the user's scope (admin dashboard). */
export async function overdueTaskCount(user: AuthUser) {
  return db.task.count({ where: { column: { not: "DONE" }, dueDate: { lt: new Date() }, project: projectScope(user) } });
}
