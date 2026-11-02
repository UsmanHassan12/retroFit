import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hashPassword, verifyPassword } from "../auth/password";
import { startSession, type AuthUser } from "../auth/session";
import { db } from "../db";
import { AppError, badRequest, notFound } from "../errors";
import { putObject } from "../integrations/storage";
import { MEDIA_PREFIX } from "./media";
import { passwordSchema } from "./auth";

/** /api/me/* — the signed-in user's own profile, password and properties. */

const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  plan: true,
  pushNotifications: true,
  createdAt: true,
} as const;

export async function getProfile(user: Pick<AuthUser, "id">) {
  const [profile, properties] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: profileSelect }),
    listProperties(user),
  ]);
  if (!profile) throw notFound("User");
  return { ...profile, createdAt: profile.createdAt.toISOString(), properties };
}

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(60),
    lastName: z.string().trim().min(1, "Enter your last name.").max(60),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+()\d\s-]*$/, "Enter a valid phone number.")
      .nullable(),
    avatarUrl: z.string().trim().max(500).nullable(),
    pushNotifications: z.boolean(),
  })
  .partial();

/** Email changes are intentionally not supported yet (README → Not done). */
export async function updateProfile(user: Pick<AuthUser, "id">, input: z.input<typeof updateProfileSchema>) {
  const data = updateProfileSchema.parse(input);
  await db.user.update({ where: { id: user.id }, data: { ...data, ...(data.phone === "" ? { phone: null } : {}) } });
  return getProfile(user);
}

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password."), password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, { message: "Passwords don’t match.", path: ["confirmPassword"] });

/** Changing the password signs out every other device (sessionVersion bump) and keeps this one. */
export async function changePassword(user: Pick<AuthUser, "id">, input: z.input<typeof changePasswordSchema>) {
  const data = changePasswordSchema.parse(input);
  const record = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(data.currentPassword, record?.passwordHash))) {
    throw new AppError("VALIDATION_FAILED", "Your current password is incorrect.", { currentPassword: "Incorrect password." });
  }
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(data.password), sessionVersion: { increment: 1 } },
    select: { id: true, role: true, sessionVersion: true },
  });
  await startSession(updated);
}

// ─── Properties ─────────────────────────────────────────────────────────────

export const propertySchema = z.object({
  line1: z.string().trim().min(2, "Enter the first line of the address.").max(120),
  line2: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().min(2, "Enter the town or city.").max(80),
  postcode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/, "Enter a valid UK postcode."),
  country: z.string().trim().default("United Kingdom"),
  propertyType: z.string().trim().min(2, "Choose the property type.").max(60),
  epcNumber: z
    .string()
    .trim()
    .regex(/^[\d-]{10,30}$/, "Enter a valid EPC certificate number.")
    .optional()
    .nullable(),
  isPrimary: z.boolean().optional(),
});
export const propertyPatchSchema = propertySchema.partial();

const toProperty = (property: any) => ({
  id: property.id as string,
  line1: property.line1 as string,
  line2: (property.line2 as string | null) ?? null,
  city: property.city as string,
  postcode: property.postcode as string,
  country: property.country as string,
  propertyType: property.propertyType as string,
  epcNumber: (property.epcNumber as string | null) ?? null,
  verified: property.verified as boolean,
  isPrimary: property.isPrimary as boolean,
});
export type PropertyDto = ReturnType<typeof toProperty>;

export async function listProperties(user: Pick<AuthUser, "id">) {
  const properties = await db.property.findMany({ where: { ownerId: user.id }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
  return properties.map(toProperty);
}

export async function createProperty(user: Pick<AuthUser, "id">, input: z.input<typeof propertySchema>) {
  const data = propertySchema.parse(input);
  const property = await db.$transaction(async (tx) => {
    const count = await tx.property.count({ where: { ownerId: user.id } });
    const isPrimary = data.isPrimary ?? count === 0;
    if (isPrimary) await tx.property.updateMany({ where: { ownerId: user.id }, data: { isPrimary: false } });
    return tx.property.create({ data: { ...data, isPrimary, ownerId: user.id } });
  });
  return toProperty(property);
}

export async function updateProperty(user: Pick<AuthUser, "id">, id: string, input: z.input<typeof propertyPatchSchema>) {
  const data = propertyPatchSchema.parse(input);
  const existing = await db.property.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) throw notFound("Property");
  const property = await db.$transaction(async (tx) => {
    if (data.isPrimary) await tx.property.updateMany({ where: { ownerId: user.id, id: { not: id } }, data: { isPrimary: false } });
    // Editing the address or EPC number means it needs verifying again.
    const reverify = data.line1 !== undefined || data.postcode !== undefined || data.epcNumber !== undefined;
    return tx.property.update({ where: { id }, data: { ...data, ...(reverify ? { verified: false } : {}) } });
  });
  return toProperty(property);
}

export async function deleteProperty(user: Pick<AuthUser, "id">, id: string) {
  const existing = await db.property.findFirst({ where: { id, ownerId: user.id }, select: { id: true, _count: { select: { projects: true } } } });
  if (!existing) throw notFound("Property");
  if (existing._count.projects > 0) throw new AppError("CONFLICT", "This property has projects and can't be removed.");
  await db.property.delete({ where: { id } });
}

// ─── Files received by server actions ───────────────────────────────────────

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Profile photo: ≤ 2MB JPEG/PNG/WebP, served from /api/media/avatars/… */
export async function setAvatar(user: Pick<AuthUser, "id">, file: File) {
  const extension = IMAGE_TYPES[file.type];
  if (!extension) throw badRequest("Upload a JPEG, PNG or WebP image.");
  if (file.size > 2 * 1024 * 1024) throw badRequest("Profile photos must be 2MB or smaller.");
  const name = `${randomUUID()}.${extension}`;
  await putObject(`${MEDIA_PREFIX}avatars/${name}`, new Uint8Array(await file.arrayBuffer()), file.type);
  const avatarUrl = `/api/media/avatars/${name}`;
  await db.user.update({ where: { id: user.id }, data: { avatarUrl } });
  return avatarUrl;
}

/** Create or update the primary property, optionally with a new EPC certificate (PDF/JPEG/PNG ≤ 10MB). */
export async function savePrimaryProperty(user: Pick<AuthUser, "id">, input: z.input<typeof propertySchema>, certificate?: File | null) {
  const data = propertySchema.parse({ ...input, isPrimary: true });
  const current = await db.property.findFirst({ where: { ownerId: user.id }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] });
  const property = current ? await updateProperty(user, current.id, data) : await createProperty(user, data);

  if (certificate && certificate.size > 0) {
    if (!["application/pdf", "image/jpeg", "image/png"].includes(certificate.type)) throw badRequest("Upload the EPC certificate as a PDF, JPEG or PNG.");
    if (certificate.size > 10 * 1024 * 1024) throw badRequest("Files must be 10MB or smaller.");
    const key = `users/${user.id}/epc/${randomUUID()}-${certificate.name.replace(/[^\w.\- ]+/g, "_")}`;
    await putObject(key, new Uint8Array(await certificate.arrayBuffer()), certificate.type);
    await db.property.update({ where: { id: property.id }, data: { epcCertificateKey: key, verified: false } });
  }
  return property;
}
