import "server-only";

import { z } from "zod";

import { findAccessibleProject, isStaff } from "../auth/permissions";
import { displayName, type AuthUser } from "../auth/session";
import { db } from "../db";
import { appUrl } from "../env";
import { renderEmail, sendEmail } from "../integrations/email";
import { notify } from "./notifications";
import { toPerson } from "./projects";

/** Project chat. Clients poll with ?after=<ISO> to fetch only new messages. */

export const postMessageSchema = z.object({ body: z.string().trim().min(1, "Write a message.").max(4000) });
export const listMessagesSchema = z.object({ after: z.coerce.date().optional() });

const authorSelect = { id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true } as const;

const toMessage = (message: any, viewerId: string) => ({
  id: message.id as string,
  body: message.body as string,
  author: toPerson(message.author)!,
  mine: message.authorId === viewerId,
  sentAt: (message.createdAt as Date).toISOString(),
});
export type MessageDto = ReturnType<typeof toMessage>;

export async function listMessages(user: AuthUser, reference: string, input: z.input<typeof listMessagesSchema> | Record<string, string> = {}) {
  const { after } = listMessagesSchema.parse(input);
  const project = await findAccessibleProject(user, reference);
  const messages = await db.message.findMany({
    where: { projectId: project.id, ...(after ? { createdAt: { gt: after } } : {}) },
    include: { author: { select: authorSelect } },
    orderBy: { createdAt: after ? "asc" : "desc" },
    take: 200,
  });
  if (!after) messages.reverse();
  return messages.map((message: any) => toMessage(message, user.id));
}

export async function postMessage(user: AuthUser, reference: string, input: z.input<typeof postMessageSchema>) {
  const { body } = postMessageSchema.parse(input);
  const project = await findAccessibleProject(user, reference);
  const message = await db.message.create({
    data: { projectId: project.id, authorId: user.id, body },
    include: { author: { select: authorSelect } },
  });
  await db.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
  await notifyMessage(user, project, body);

  // Staff replies notify the client by email.
  if (isStaff(user)) {
    const client = await db.user.findUnique({ where: { id: project.clientId }, select: { email: true, firstName: true, lastName: true } });
    if (client) {
      const email = renderEmail(
        {
          subject: "New message on {{project_ref}}",
          html: `<h2>New message from {{author}}</h2><p>Hello {{user_name}},</p><p style="white-space:pre-wrap">{{body}}</p><a href="{{link}}" class="btn">Reply</a>`,
        },
        {
          project_ref: project.reference,
          author: user.name,
          user_name: displayName(client),
          body: body.length > 600 ? `${body.slice(0, 600)}…` : body,
          link: appUrl(`/dashboard/projects/${project.reference}/messages`),
        },
      );
      await sendEmail({ to: client.email, ...email }).catch((error) => console.error("[messages] email failed", error));
    }
  }
  return toMessage(message, user.id);
}

/**
 * Bell notification for the other side of the conversation:
 * client writes → the project's coordinator and team (or all admins if nobody is assigned);
 * staff write → the client.
 */
async function notifyMessage(author: AuthUser, project: { id: string; reference: string; clientId: string; coordinatorId: string | null }, body: string) {
  const preview = body.length > 140 ? `${body.slice(0, 140)}…` : body;
  if (isStaff(author)) {
    await notify({
      userIds: [project.clientId],
      type: "MESSAGE",
      projectId: project.id,
      title: `New message from ${author.name} on ${project.reference}`,
      mergedTitle: (count) => `${count} new messages on ${project.reference}`,
      body: preview,
      href: `/dashboard/projects/${project.reference}/messages`,
    });
    return;
  }
  const members = await db.projectMember.findMany({ where: { projectId: project.id, user: { status: "ACTIVE" } }, select: { userId: true } });
  let staff = [project.coordinatorId, ...members.map((member: { userId: string }) => member.userId)].filter((id): id is string => Boolean(id));
  if (!staff.length) {
    const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    staff = admins.map((admin: { id: string }) => admin.id);
  }
  await notify({
    userIds: staff.filter((id) => id !== author.id),
    type: "MESSAGE",
    projectId: project.id,
    title: `New message from ${author.name} on ${project.reference}`,
    mergedTitle: (count) => `${count} new messages from the client on ${project.reference}`,
    body: preview,
    href: `/admin/projects/${project.reference}?tab=messages#workspace`,
  });
}
