import "server-only";

import { z } from "zod";

import { createToken, hashPassword, hashToken, PASSWORD_RULES, verifyPassword } from "../auth/password";
import {
  displayName,
  endSession,
  getCurrentUser,
  IMPERSONATION_TTL_SECONDS,
  requireUser,
  startSession,
} from "../auth/session";
import { db } from "../db";
import { appUrl } from "../env";
import { CUSTOMER_TYPES } from "../domain";
import { AppError, badRequest, conflict } from "../errors";
import { sendTemplate } from "../integrations/email";
import { audit } from "./audit";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const RESET_TTL_MS = 60 * 60 * 1000;

// ─── Schemas ────────────────────────────────────────────────────────────────

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const passwordSchema = z.string().superRefine((value, ctx) => {
  const problem = PASSWORD_RULES.test(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

const confirmed = <T extends { password: string; confirmPassword: string }>(data: T) => data.password === data.confirmPassword;
const mismatch = { message: "Passwords don’t match.", path: ["confirmPassword"] };

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    firstName: z.string().trim().max(60).optional(),
    lastName: z.string().trim().max(60).optional(),
    companyName: z.string().trim().max(120).optional(),
    customerType: z.enum(CUSTOMER_TYPES).optional(),
  })
  .refine(confirmed, mismatch);

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.") });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ token: z.string().min(10), password: passwordSchema, confirmPassword: z.string() })
  .refine(confirmed, mismatch);

export const acceptInviteSchema = z
  .object({
    token: z.string().min(10),
    firstName: z.string().trim().min(1, "Enter your first name.").max(60),
    lastName: z.string().trim().min(1, "Enter your last name.").max(60),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(confirmed, mismatch);

// ─── Use cases ──────────────────────────────────────────────────────────────

/** First/last name from "sarah.jenkins@…" when the form didn't collect them. */
function nameFromEmail(email: string) {
  const parts = (email.split("@")[0] ?? "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1));
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export async function register(input: z.input<typeof registerSchema>) {
  const data = registerSchema.parse(input);
  const existing = await db.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) throw conflict("An account with this email already exists.", { email: "An account with this email already exists." });

  const fallback = nameFromEmail(data.email);
  const user = await db.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      firstName: data.firstName || fallback.firstName,
      lastName: data.lastName || fallback.lastName,
      companyName: data.companyName || null,
      customerType: data.customerType ?? null,
      role: "CLIENT",
      lastLoginAt: new Date(),
    },
    select: { id: true, role: true, sessionVersion: true },
  });
  await startSession(user);
  return user;
}

export async function login(input: z.input<typeof loginSchema>) {
  const { email, password } = loginSchema.parse(input);
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true, passwordHash: true, failedLoginCount: true, lockedUntil: true, sessionVersion: true },
  });

  const invalid = new AppError("UNAUTHENTICATED", "Incorrect email or password.");
  if (!user) {
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA"); // even out timing
    throw invalid;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new AppError("LOCKED", `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failures = user.failedLoginCount + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: lock
        ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : { failedLoginCount: failures },
    });
    if (lock) throw new AppError("LOCKED", `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
    throw invalid;
  }
  if (user.status !== "ACTIVE") throw new AppError("FORBIDDEN", "This account has been suspended. Contact support.");

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await startSession(user);
  return { id: user.id, role: user.role };
}

export async function logout() {
  await endSession();
}

export async function forgotPassword(input: z.input<typeof forgotPasswordSchema>) {
  const { email } = forgotPasswordSchema.parse(input);
  const user = await db.user.findUnique({ where: { email }, select: { id: true, status: true, firstName: true, lastName: true, email: true } });
  // Always succeed so the endpoint can't be used to discover accounts.
  if (!user || user.status !== "ACTIVE") return;

  const { token, tokenHash } = createToken();
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
  await sendTemplate("password_reset", user.email, {
    user_name: displayName(user),
    link: appUrl(`/reset-password?token=${encodeURIComponent(token)}`),
  });
}

export async function resetPassword(input: z.input<typeof resetPasswordSchema>) {
  const data = resetPasswordSchema.parse(input);
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(data.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw badRequest("This reset link is invalid or has expired. Request a new one.");
  }
  const passwordHash = await hashPassword(data.password);
  const user = await db.$transaction(async (tx) => {
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null, sessionVersion: { increment: 1 } },
      select: { id: true, role: true, sessionVersion: true },
    });
  });
  await startSession(user);
  return user;
}

/** Look up an invite for the accept page (email + role), without consuming it. */
export async function peekInvite(token: string) {
  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null;
  return { email: invite.email, role: invite.role };
}

export async function acceptInvite(input: z.input<typeof acceptInviteSchema>) {
  const data = acceptInviteSchema.parse(input);
  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(data.token) } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw badRequest("This invitation is invalid or has expired. Ask an admin to resend it.");
  }
  const passwordHash = await hashPassword(data.password);

  const user = await db.$transaction(async (tx) => {
    const account = await tx.user.upsert({
      where: { email: invite.email },
      create: {
        email: invite.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        role: invite.role,
        canViewAllProjects: invite.canViewAllProjects,
        lastLoginAt: new Date(),
      },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash,
        role: invite.role,
        status: "ACTIVE",
        canViewAllProjects: invite.canViewAllProjects,
        sessionVersion: { increment: 1 },
      },
      select: { id: true, role: true, sessionVersion: true },
    });
    if (invite.projectIds.length) {
      await tx.projectMember.createMany({
        data: invite.projectIds.map((projectId: string) => ({ projectId, userId: account.id })),
        skipDuplicates: true,
      });
    }
    await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    return account;
  });
  await startSession(user);
  return user;
}

/** Return to the admin's own session after impersonating. */
export async function stopImpersonation() {
  const current = await requireUser();
  if (!current.impersonatorId) throw badRequest("You are not impersonating anyone.");
  const admin = await db.user.findUnique({
    where: { id: current.impersonatorId },
    select: { id: true, role: true, status: true, sessionVersion: true },
  });
  if (!admin || admin.role !== "ADMIN" || admin.status !== "ACTIVE") {
    await endSession();
    throw new AppError("UNAUTHENTICATED", "Your admin session has ended. Please sign in again.");
  }
  await audit(admin.id, "impersonation.stop", "User", current.id);
  await startSession(admin);
  return admin;
}

export async function impersonate(adminId: string, targetId: string) {
  const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, status: true, sessionVersion: true } });
  if (!target) throw new AppError("NOT_FOUND", "User not found.");
  if (target.role === "ADMIN") throw new AppError("FORBIDDEN", "Admins can't be impersonated.");
  if (target.status !== "ACTIVE") throw badRequest("Suspended users can't be impersonated.");
  await audit(adminId, "impersonation.start", "User", target.id);
  await startSession(target, { impersonatorId: adminId, ttlSeconds: IMPERSONATION_TTL_SECONDS });
  return target;
}

/** GET /api/auth/me */
export async function me() {
  const user = await getCurrentUser();
  if (!user) return null;
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      canViewAllProjects: user.canViewAllProjects,
    },
    tier: user.tier,
    impersonating: Boolean(user.impersonatorId),
    expiresAt: new Date(user.expiresAt).toISOString(),
  };
}
