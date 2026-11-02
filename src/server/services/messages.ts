import "server-only";

import { z } from "zod";

import { findAccessibleProject, isStaff } from "../auth/permissions";
import { displayName, type AuthUser } from "../auth/session";
import { db } from "../db";
import { appUrl } from "../env";
import { renderEmail, sendEmail } from "../integrations/email";
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
