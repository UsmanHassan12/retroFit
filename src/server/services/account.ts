import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { hashPassword, verifyPassword } from "../auth/password";
import { startSession, type AuthUser } from "../auth/session";
import { db } from "../db";
import { CUSTOMER_TYPES } from "../domain";
import { AppError, badRequest, notFound } from "../errors";
import { parseCsv } from "../rules/csv";
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
  companyName: true,
  customerType: true,
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
    companyName: z.string().trim().max(120).nullable(),
    customerType: z.enum(CUSTOMER_TYPES).nullable(),
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

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);

/** Intake steps 2–4: address (UPRN from the lookup), property basics and occupant contact. */
export const propertySchema = z.object({
  label: optionalText(80),
  uprn: z
    .string()
    .trim()
    .regex(/^\d{1,12}$/, "UPRN is up to 12 digits.")
    .optional()
    .nullable(),
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
  builtForm: z.enum(["detached", "semi-detached", "mid-terrace", "end-terrace"]).optional().nullable(),
  buildYear: z.number().int().min(1500).max(2100).optional().nullable(),
  storeys: z.number().int().min(1).max(60).optional().nullable(),
  bedrooms: z.number().int().min(0).max(50).optional().nullable(),
  tenure: z.enum(["owner-occupied", "private rented", "social"]).optional().nullable(),
  occupantName: optionalText(120),
  occupantPhone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+()\d\s-]*$/, "Enter a valid phone number.")
    .optional()
    .nullable(),
  accessNotes: optionalText(500),
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
  label: (property.label as string | null) ?? null,
  uprn: (property.uprn as string | null) ?? null,
  line1: property.line1 as string,
  line2: (property.line2 as string | null) ?? null,
  city: property.city as string,
  postcode: property.postcode as string,
  country: property.country as string,
  propertyType: property.propertyType as string,
  builtForm: (property.builtForm as string | null) ?? null,
  buildYear: (property.buildYear as number | null) ?? null,
  storeys: (property.storeys as number | null) ?? null,
  bedrooms: (property.bedrooms as number | null) ?? null,
  tenure: (property.tenure as string | null) ?? null,
  occupantName: (property.occupantName as string | null) ?? null,
  occupantPhone: (property.occupantPhone as string | null) ?? null,
  accessNotes: (property.accessNotes as string | null) ?? null,
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
    const reverify = data.line1 !== undefined || data.postcode !== undefined || data.epcNumber !== undefined || data.uprn !== undefined;
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

/**
 * Partner bulk upload (intake: "book one service for many properties in one order").
 * CSV columns (header names are flexible): reference, uprn, address_line_1, address_line_2,
 * city, postcode, property_type, built_form, build_year, storeys, bedrooms, tenure,
 * occupant_name, occupant_phone, access_notes.
 * Existing properties with the same postcode and first line are reused. Returns one result
 * per row so the UI can show what failed.
 */
export async function importPropertiesCsv(user: Pick<AuthUser, "id">, csv: string, limit = 1_000) {
  const rows = parseCsv(csv);
  if (!rows.length) throw badRequest("The file has no rows. Include a header row.");
  if (rows.length > limit) throw badRequest(`Upload up to ${limit} properties at a time.`);
  const pick = (row: Record<string, string>, ...keys: string[]) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== "") ?? undefined;
  const int = (value: string | undefined) => (value && /^\d+$/.test(value) ? Number(value) : undefined);

  const results: Array<{ row: number; ok: boolean; propertyId?: string; reused?: boolean; errors?: Record<string, string> }> = [];
  const existing = await db.property.findMany({ where: { ownerId: user.id }, select: { id: true, line1: true, postcode: true } });
  const key = (line1: string, postcode: string) => `${line1.trim().toLowerCase()}|${postcode.replace(/\s+/g, "").toUpperCase()}`;
  const known = new Map<string, string>(existing.map((property: any) => [key(property.line1, property.postcode), property.id as string]));

  for (const [index, row] of rows.entries()) {
    const parsed = propertySchema.safeParse({
      label: pick(row, "reference", "ref", "label"),
      uprn: pick(row, "uprn"),
      line1: pick(row, "address_line_1", "line1", "address1", "address") ?? "",
      line2: pick(row, "address_line_2", "line2", "address2"),
      city: pick(row, "city", "town") ?? "",
      postcode: pick(row, "postcode", "post_code") ?? "",
      propertyType: pick(row, "property_type", "type") ?? "house",
      builtForm: pick(row, "built_form")?.toLowerCase(),
      buildYear: int(pick(row, "build_year", "year_built")),
      storeys: int(pick(row, "storeys")),
      bedrooms: int(pick(row, "bedrooms")),
      tenure: pick(row, "tenure")?.toLowerCase(),
      occupantName: pick(row, "occupant_name"),
      occupantPhone: pick(row, "occupant_phone"),
      accessNotes: pick(row, "access_notes", "notes"),
    });
    if (!parsed.success) {
      results.push({ row: index + 2, ok: false, errors: Object.fromEntries(parsed.error.issues.map((issue) => [issue.path.join("."), issue.message])) });
      continue;
    }
    const match = known.get(key(parsed.data.line1, parsed.data.postcode));
    if (match) {
      results.push({ row: index + 2, ok: true, propertyId: match, reused: true });
      continue;
    }
    const property = await db.property.create({ data: { ...parsed.data, ownerId: user.id, isPrimary: existing.length === 0 && index === 0 } });
    known.set(key(property.line1, property.postcode), property.id);
    results.push({ row: index + 2, ok: true, propertyId: property.id, reused: false });
  }
  return { imported: results.filter((result) => result.ok && !result.reused).length, reused: results.filter((result) => result.reused).length, failed: results.filter((result) => !result.ok).length, results };
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
