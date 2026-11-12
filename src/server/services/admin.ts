import "server-only";

import { z } from "zod";

import { createToken } from "../auth/password";
import { projectScope } from "../auth/permissions";
import { type AuthUser } from "../auth/session";
import { db } from "../db";
import { appUrl, integrations } from "../env";
import { AppError, badRequest, conflict, notFound } from "../errors";
import { EMAIL_TEMPLATE_KEYS, ROLES, STAFF_ROLES, type EmailTemplateKey, type Role } from "../domain";
import { DEFAULT_TEMPLATES, loadTemplate, renderEmail, sendTemplate } from "../integrations/email";
import { audit } from "./audit";
import { emailSchema } from "./auth";
import { toPerson } from "./projects";
import { overdueTaskCount } from "./tasks";

// ─── Dashboard ──────────────────────────────────────────────────────────────

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);

export async function adminDashboard(user: AuthUser) {
  const scope = projectScope(user);
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const isAdmin = user.role === "ADMIN";

  const open = { status: { notIn: ["COMPLETED" as const, "CANCELLED" as const] } };
  const [newToday, active, overdue, revenueMtd, healthGroups, completedCount, completed, priority, staff, paidOrders, waiting, holds] = await Promise.all([
    db.project.count({ where: { AND: [scope, { createdAt: { gte: startOfDay(now) } }] } }),
    db.project.count({ where: { AND: [scope, open] } }),
    overdueTaskCount(user),
    // Revenue = confirmed bookings (net of VAT), whether paid by card, credit or weekly invoice.
    isAdmin ? db.order.aggregate({ where: { status: "CONFIRMED", confirmedAt: { gte: startOfMonth(now) } }, _sum: { netPence: true } }) : null,
    db.project.groupBy({ by: ["health"], where: { AND: [scope, open] }, _count: { _all: true } }),
    db.project.count({ where: { AND: [scope, { status: "COMPLETED" }] } }),
    db.project.findMany({ where: { AND: [scope, { completedAt: { not: null } }] }, select: { startedAt: true, completedAt: true }, take: 200, orderBy: { completedAt: "desc" } }),
    db.project.findMany({
      where: { AND: [scope, open, { OR: [{ hasIssues: true }, { priority: { in: ["HIGH", "QA_REJECT"] } }, { partnerPriority: true }] }] },
      include: { property: true, coordinator: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true } } },
      orderBy: [{ criticalIssue: "desc" }, { partnerPriority: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }],
      take: 8,
    }),
    db.user.findMany({
      where: { role: { in: [...STAFF_ROLES] }, status: "ACTIVE" },
      select: {
        firstName: true,
        _count: { select: { assignedTasks: { where: { column: { not: "DONE" } } }, coordinatedProjects: { where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } } } },
      },
      take: 8,
      orderBy: { firstName: "asc" },
    }),
    isAdmin ? db.order.findMany({ where: { status: "CONFIRMED", confirmedAt: { gte: sixMonthsAgo } }, select: { confirmedAt: true, netPence: true } }) : [],
    db.project.count({ where: { AND: [scope, { status: "AWAITING_INFO" }] } }),
    isAdmin ? db.accountHold.count({ where: { liftedAt: null } }) : 0,
  ]);

  const healthCounts = Object.fromEntries(healthGroups.map((group: any) => [group.health, group._count._all as number]));
  const totalProjects = healthGroups.reduce((sum: number, group: any) => sum + group._count._all, 0) + completedCount;
  const days = completed
    .filter((project: any) => project.completedAt)
    .map((project: any) => (project.completedAt.getTime() - project.startedAt.getTime()) / 86_400_000);
  const compliance = await db.project.aggregate({ where: scope, _avg: { compliancePercent: true } });

  // Revenue per half-month for the last six months.
  const buckets: number[] = Array.from({ length: 12 }, () => 0);
  for (const order of paidOrders as Array<{ confirmedAt: Date; netPence: number }>) {
    const monthIndex = (order.confirmedAt.getFullYear() - sixMonthsAgo.getFullYear()) * 12 + order.confirmedAt.getMonth() - sixMonthsAgo.getMonth();
    const bucket = monthIndex * 2 + (order.confirmedAt.getDate() > 15 ? 1 : 0);
    if (bucket >= 0 && bucket < buckets.length) buckets[bucket]! += order.netPence;
  }

  return {
    stats: {
      newToday,
      activeProjects: active,
      overdueTasks: overdue,
      revenueMtdPence: revenueMtd ? ((revenueMtd._sum.netPence as number | null) ?? 0) : null,
      awaitingInfo: waiting,
      accountsOnHold: holds,
      avgCompletionDays: days.length ? Math.round(days.reduce((a: number, b: number) => a + b, 0) / days.length) : null,
      compliancePercent: Math.round((compliance._avg.compliancePercent as number | null) ?? 100),
    },
    workload: staff.map((member: any) => ({ name: member.firstName as string, value: member._count.assignedTasks + member._count.coordinatedProjects })),
    projectStatus: {
      total: totalProjects,
      onTrack: healthCounts.ON_TRACK ?? 0,
      atRisk: healthCounts.AT_RISK ?? 0,
      delayed: healthCounts.DELAYED ?? 0,
      completed: completedCount,
    },
    revenueTrend: isAdmin
      ? {
          months: Array.from({ length: 6 }, (_, index) =>
            new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + index, 1).toLocaleString("en-GB", { month: "short" }),
          ),
          pointsPence: buckets,
        }
      : null,
    priorityQueue: priority.map((project: any) => ({
      reference: project.reference as string,
      property: project.property ? `${project.property.line1}, ${project.property.city}` : project.title,
      issue: (project.issueSummary as string | null) ?? "Needs attention",
      dueDate: project.dueDate ? (project.dueDate as Date).toISOString() : null,
      priority: project.priority as string,
      assignee: toPerson(project.coordinator),
    })),
  };
}

// ─── Users & invites ────────────────────────────────────────────────────────

export const userFiltersSchema = z.object({
  role: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter((item): item is Role => (ROLES as readonly string[]).includes(item)),
    ),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  q: z.string().trim().max(100).optional(),
  staffOnly: z.enum(["true", "false"]).optional(),
});

const toUserRow = (user: any) => ({
  ...toPerson(user)!,
  firstName: user.firstName as string,
  lastName: user.lastName as string,
  status: user.status as string,
  tier: user.partnerProfile?.status === "ACTIVE" ? "PARTNER" : "BASIC",
  partnerStatus: (user.partnerProfile?.status as string | undefined) ?? null,
  companyName: (user.companyName as string | null) ?? null,
  canViewAllProjects: user.canViewAllProjects as boolean,
  lastLoginAt: user.lastLoginAt ? (user.lastLoginAt as Date).toISOString() : null,
  projectCount: ((user._count?.memberships ?? 0) as number) + ((user._count?.clientProjects ?? 0) as number),
  createdAt: (user.createdAt as Date).toISOString(),
});

export async function listUsers(input: z.input<typeof userFiltersSchema> | Record<string, string> = {}) {
  const filters = userFiltersSchema.parse(input);
  const users = await db.user.findMany({
    where: {
      ...(filters.role.length ? { role: { in: filters.role } } : filters.staffOnly === "true" ? { role: { not: "CLIENT" } } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.q
        ? {
            OR: [
              { email: { contains: filters.q, mode: "insensitive" as const } },
              { firstName: { contains: filters.q, mode: "insensitive" as const } },
              { lastName: { contains: filters.q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { memberships: true, clientProjects: true } }, partnerProfile: { select: { status: true } } },
    orderBy: [{ role: "desc" }, { firstName: "asc" }],
    take: 200,
  });
  const pendingInvites = await db.invite.findMany({
    where: { acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
  return { users: users.map(toUserRow), invites: pendingInvites };
}

export async function getUser(id: string) {
  const user = await db.user.findUnique({ where: { id }, include: { _count: { select: { memberships: true, clientProjects: true } }, partnerProfile: { select: { status: true } } } });
  if (!user) throw notFound("User");
  return toUserRow(user);
}

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(STAFF_ROLES, { message: "Choose a role." }),
  canViewAllProjects: z.boolean().default(false),
  projectIds: z.array(z.string()).max(50).default([]),
});

export async function inviteUser(admin: AuthUser, input: z.input<typeof inviteSchema>) {
  const data = inviteSchema.parse(input);
  const existing = await db.user.findUnique({ where: { email: data.email }, select: { role: true, status: true } });
  if (existing && existing.role !== "CLIENT" && existing.status === "ACTIVE") throw conflict("This person is already on the team.");
  if (data.projectIds.length) {
    const found = await db.project.count({ where: { id: { in: data.projectIds } } });
    if (found !== data.projectIds.length) throw badRequest("One of the selected projects doesn't exist.");
  }

  const { token, tokenHash } = createToken();
  await db.$transaction([
    // A fresh invite replaces any pending one for the same address.
    db.invite.deleteMany({ where: { email: data.email, acceptedAt: null } }),
    db.invite.create({
      data: {
        email: data.email,
        role: data.role,
        canViewAllProjects: data.canViewAllProjects,
        projectIds: data.projectIds,
        tokenHash,
        invitedById: admin.id,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    }),
  ]);
  await sendTemplate("invite", data.email, {
    inviter_name: admin.name,
    role: data.role.charAt(0) + data.role.slice(1).toLowerCase(),
    link: appUrl(`/accept-invite?token=${encodeURIComponent(token)}`),
  });
  await audit(admin.id, "user.invite", "Invite", data.email, { role: data.role });
  return { email: data.email, role: data.role };
}

export const updateUserSchema = z
  .object({
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    role: z.enum(ROLES),
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    canViewAllProjects: z.boolean(),
  })
  .partial();

export async function updateUser(admin: AuthUser, id: string, input: z.input<typeof updateUserSchema>) {
  const data = updateUserSchema.parse(input);
  if (id === admin.id && (data.role && data.role !== "ADMIN" || data.status === "SUSPENDED")) {
    throw new AppError("FORBIDDEN", "You can't demote or suspend your own account.");
  }
  const existing = await db.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  if (!existing) throw notFound("User");
  if (existing.role === "ADMIN" && ((data.role && data.role !== "ADMIN") || data.status === "SUSPENDED")) {
    const admins = await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (admins <= 1) throw conflict("At least one active admin is required.");
  }
  // Role or status changes sign the user out everywhere.
  const revoke = (data.role && data.role !== existing.role) || (data.status && data.status !== existing.status);
  await db.user.update({ where: { id }, data: { ...data, ...(revoke ? { sessionVersion: { increment: 1 } } : {}) } });
  await audit(admin.id, "user.update", "User", id, data);
  return getUser(id);
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function integrationStatus() {
  const [lastOrder, documents] = await Promise.all([
    db.order.findFirst({ where: { status: "CONFIRMED", paidAt: { not: null } }, orderBy: { paidAt: "desc" }, select: { paidAt: true } }),
    db.document.count({ where: { status: "ACTIVE" } }),
  ]);
  return [
    {
      key: "stripe",
      name: "Stripe Payments",
      connected: integrations.stripe(),
      status: integrations.stripe() ? "Connected" : "Not configured",
      detail: integrations.stripe()
        ? lastOrder?.paidAt
          ? `Last payment: ${lastOrder.paidAt.toISOString()}`
          : "No payments yet"
        : "Development mode: orders are marked paid instantly",
    },
    {
      key: "s3",
      name: "AWS S3 Storage",
      connected: integrations.s3(),
      status: integrations.s3() ? "Operational" : "Local disk",
      detail: `${documents} document${documents === 1 ? "" : "s"} stored`,
    },
    {
      key: "sendgrid",
      name: "SendGrid API",
      connected: integrations.sendgrid(),
      status: integrations.sendgrid() ? "Operational" : "Console output",
      detail: integrations.sendgrid() ? "Sending live email" : "Emails are printed to the server log",
    },
  ];
}

// ─── Email templates ────────────────────────────────────────────────────────

export const templateKeySchema = z.enum(EMAIL_TEMPLATE_KEYS);
export const templateSchema = z.object({
  subject: z.string().trim().min(3, "Add a subject.").max(200),
  html: z.string().trim().min(10, "The template looks empty.").max(50_000),
});

const SAMPLE_VARIABLES: Record<string, string> = {
  user_name: "Sarah Jenkins",
  project_name: "Whole-House Retrofit Assessment",
  project_ref: "RET-2026-0042",
  phase: "Technical Survey",
  inviter_name: "Admin",
  role: "Coordinator",
  service_name: "Whole-House Retrofit Assessment",
  order_ref: "ORD-2026-000123",
  total: "£270.00",
  payment: "Paid (receipt INV-2026-0001).",
  invoice_number: "INV-2026-0001",
  due: "Friday 20 November, 18:00",
  reason: "Invoice INV-2026-0001 is overdue",
  company: "Acme Insulation Ltd",
  user_email: "ops@acme.example",
  discount: "10%",
  payment_mode: "weekly invoice",
  fee: "£199.00",
  amount: "£500.00",
  balance: "£730.00",
  receipt_number: "INV-2026-0002",
  link: "https://example.com",
};

export async function listTemplates() {
  return Promise.all(
    EMAIL_TEMPLATE_KEYS.map(async (key) => {
      const template = await loadTemplate(key);
      return { ...template, variables: DEFAULT_TEMPLATES[key].variables };
    }),
  );
}

export async function getTemplate(key: EmailTemplateKey) {
  return { ...(await loadTemplate(key)), variables: DEFAULT_TEMPLATES[key].variables };
}

export async function saveTemplate(admin: AuthUser, key: EmailTemplateKey, input: z.input<typeof templateSchema>) {
  const data = templateSchema.parse(input);
  await db.emailTemplate.upsert({ where: { key }, create: { key, ...data, updatedById: admin.id }, update: { ...data, updatedById: admin.id } });
  await audit(admin.id, "email_template.save", "EmailTemplate", key);
  return getTemplate(key);
}

/** Reset to the built-in default. */
export async function resetTemplate(admin: AuthUser, key: EmailTemplateKey) {
  await db.emailTemplate.deleteMany({ where: { key } });
  await audit(admin.id, "email_template.reset", "EmailTemplate", key);
  return getTemplate(key);
}

export async function previewTemplate(key: EmailTemplateKey, input?: Partial<z.input<typeof templateSchema>>) {
  const stored = await loadTemplate(key);
  return renderEmail({ subject: input?.subject ?? stored.subject, html: input?.html ?? stored.html }, SAMPLE_VARIABLES);
}

// ─── Discount codes ─────────────────────────────────────────────────────────

export const discountSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,32}$/, "Use 3–32 letters, numbers, dashes or underscores."),
  percentOff: z.number().int().min(1).max(100),
  active: z.boolean().default(true),
  expiresAt: z.coerce.date().nullable().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
});
export const discountPatchSchema = discountSchema.omit({ code: true }).partial();

export async function listDiscountCodes() {
  return db.discountCode.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createDiscountCode(admin: AuthUser, input: z.input<typeof discountSchema>) {
  const data = discountSchema.parse(input);
  const exists = await db.discountCode.findUnique({ where: { code: data.code }, select: { id: true } });
  if (exists) throw conflict("That code already exists.");
  const code = await db.discountCode.create({ data });
  await audit(admin.id, "discount.create", "DiscountCode", code.id);
  return code;
}

export async function updateDiscountCode(admin: AuthUser, id: string, input: z.input<typeof discountPatchSchema>) {
  const data = discountPatchSchema.parse(input);
  const code = await db.discountCode.update({ where: { id }, data }).catch(() => null);
  if (!code) throw notFound("Discount code");
  await audit(admin.id, "discount.update", "DiscountCode", id, data);
  return code;
}
