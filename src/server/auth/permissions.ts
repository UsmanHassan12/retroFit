import "server-only";

import { db } from "../db";
import { forbidden, notFound } from "../errors";
import { isStaffRole } from "../domain";
import type { AuthUser } from "./session";

/**
 * Project access rules (README → Roles):
 *  - CLIENT: only their own projects. Others' projects are a 404, never a 403, so
 *    references can't be probed.
 *  - ASSESSOR / DESIGNER / COORDINATOR: projects they coordinate or are a member of,
 *    or every project when "View all projects" is ticked.
 *  - ADMIN: everything.
 */

type Who = Pick<AuthUser, "id" | "role" | "canViewAllProjects">;

/** Prisma `where` fragment limiting projects to what this user may see. */
export function projectScope(user: Who) {
  if (user.role === "ADMIN" || (isStaffRole(user.role) && user.canViewAllProjects)) return {};
  if (user.role === "CLIENT") return { clientId: user.id };
  return { OR: [{ coordinatorId: user.id }, { members: { some: { userId: user.id } } }] };
}

/** Load a project by reference within the user's scope, or 404. */
export async function findAccessibleProject(user: Who, reference: string) {
  const project = await db.project.findFirst({
    where: { reference, ...projectScope(user) },
    select: { id: true, reference: true, clientId: true, coordinatorId: true, title: true, phase: true },
  });
  if (!project) throw notFound("Project");
  return project;
}

export const isStaff = (user: Pick<AuthUser, "role">) => isStaffRole(user.role);

/** Coordinators and admins may reassign the coordinator / team. */
export function assertCanManageTeam(user: Pick<AuthUser, "role">) {
  if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
    throw forbidden("Only coordinators and admins can change the project team.");
  }
}

export function assertStaff(user: Pick<AuthUser, "role">) {
  if (!isStaffRole(user.role)) throw notFound();
}
