import "server-only";

import { z } from "zod";

import { Prisma } from "@prisma/client";

import { db } from "../db";
import {
  ADDON_AUDIENCES,
  ADDON_KINDS,
  DELIVERABLE_KINDS,
  DOCUMENT_TIMINGS,
  INTAKE_FIELD_TYPES,
  INTAKE_SCOPES,
  PRICE_UNIT_LABELS,
  PRICE_UNITS,
  PROJECT_STATUSES,
  SCHEMES,
  SERVICE_CATEGORIES,
  SITE_VISIT,
  STAGE_ROLES,
  TASK_COLUMNS,
  type PriceUnit,
} from "../domain";
import { badRequest, notFound } from "../errors";
import { isCondition } from "../rules/conditions";
import { audit } from "./audit";
import { toQuestionDto, toRequirementDto, type QuestionRow } from "./intake";

/**
 * Service catalogue (catalogue doc → "Service catalogue"). Every service has one list price
 * per unit; the customer's tier decides discount, speed and payment terms. Stages, intake
 * questions, document lists, deliverables and add-ons are rows the admin can edit.
 */

const detailInclude = {
  stages: { orderBy: { position: "asc" } },
  addons: { where: { active: true }, orderBy: { position: "asc" } },
  deliverables: { orderBy: { position: "asc" } },
  documentRequirements: { orderBy: { position: "asc" } },
  questions: { where: { active: true }, orderBy: [{ step: "asc" }, { position: "asc" }] },
} satisfies Prisma.ServiceInclude;

type IconCard = { title: string; description: string; icon: string };

const days = (value: number | null) => (value === null ? null : value === 0 ? "Same day" : `${value} working day${value === 1 ? "" : "s"}`);

/** "5 working days after visit", "Same day", or the admin's label. */
export function turnaroundText(service: { standardDays: number | null; fastTrackDays: number | null; standardLabel: string | null; fastTrackLabel: string | null; siteVisit: string }) {
  const suffix = service.siteVisit === "REQUIRED" ? " after visit" : "";
  return {
    standard: service.standardLabel ?? (service.standardDays === null ? "Agreed per booking" : `${days(service.standardDays)}${service.standardDays === 0 ? "" : suffix}`),
    fastTrack: service.fastTrackLabel ?? (service.fastTrackDays === null ? null : `${days(service.fastTrackDays)}${service.fastTrackDays === 0 ? "" : suffix}`),
  };
}

/** Public JSON shape (pence). The frontend adapter turns this into its view model. */
export function toServiceDto(service: any) {
  const unit = service.priceUnit as PriceUnit;
  const turnaround = turnaroundText(service);
  return {
    id: service.id as string,
    code: service.code as string,
    slug: service.slug as string,
    title: service.title as string,
    headline: service.headline as string,
    summary: service.summary as string,
    intro: service.intro as string,
    category: service.category as string,
    badge: service.badge as string,
    schemes: service.schemes as string[],
    imageUrl: service.imageUrl as string,
    gallery: service.gallery as string[],
    active: service.active as boolean,
    pricing: {
      unit,
      unitLabel: PRICE_UNIT_LABELS[unit].one,
      unitLabelPlural: PRICE_UNIT_LABELS[unit].many,
      listPricePence: service.listPricePence as number,
      discountable: service.discountable as boolean,
      siteVisit: service.siteVisit as string,
      requiresProperty: service.requiresProperty as boolean,
      standardDays: service.standardDays as number | null,
      fastTrackDays: service.fastTrackDays as number | null,
      revisionRounds: service.revisionRounds as number,
    },
    /** "5 working days after visit" (Basic) / "2 working days after visit" (Premium Partner). */
    turnaround: turnaround.standard,
    fastTrackTurnaround: turnaround.fastTrack,
    fromPricePence: service.listPricePence as number,
    addons: (service.addons ?? []).map((addon: any) => ({
      id: addon.id as string,
      key: addon.key as string,
      name: addon.name as string,
      description: addon.description as string,
      kind: addon.kind as string,
      amount: addon.amount as number,
      freeAllowance: addon.freeAllowance as number,
      audience: addon.audience as string,
      fastTrack: addon.fastTrack as boolean,
      icon: addon.icon as string,
    })),
    /** Client-visible workflow stages (Timeline tab). */
    timeline: (service.stages ?? [])
      .filter((stage: any) => stage.clientVisible)
      .map((stage: any) => ({ title: stage.name as string, description: (stage.description as string) || "" })),
    stages: (service.stages ?? []).map((stage: any) => ({
      id: stage.id as string,
      position: stage.position as number,
      name: stage.name as string,
      description: stage.description as string,
      clientVisible: stage.clientVisible as boolean,
      defaultRole: stage.defaultRole as string,
      slaDays: stage.slaDays as number | null,
      boardColumn: stage.boardColumn as string,
      projectStatus: (stage.projectStatus as string | null) ?? null,
    })),
    serviceDeliverables: (service.deliverables ?? []).map((item: any) => ({ id: item.id as string, name: item.name as string, description: item.description as string, kind: item.kind as string, versioned: item.versioned as boolean })),
    documents: (service.documentRequirements ?? []).map(toRequirementDto),
    questions: (service.questions ?? []).map((question: QuestionRow) => toQuestionDto(question)),
    overview: service.overview as { paragraphs: string[]; keyAreas: string[] },
    included: service.included as string[],
    compliance: service.compliance as IconCard[],
    deliverables: service.deliverablesInfo as IconCard[],
    updatedAt: (service.updatedAt as Date).toISOString(),
  };
}

export type ServiceDto = ReturnType<typeof toServiceDto>;

// ─── Storefront ─────────────────────────────────────────────────────────────

export const serviceFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((item) => item.trim().toUpperCase().replace(/-/g, "_"))
        .filter((item): item is (typeof SERVICE_CATEGORIES)[number] => (SERVICE_CATEGORIES as readonly string[]).includes(item)),
    ),
  budget: z.enum(["under-100", "100-300", "300-plus", "under-500", "500-1000", "1000+", "1000-plus"]).optional(),
});

const BUDGETS: Record<string, readonly [number, number]> = {
  "under-100": [0, 9_999],
  "100-300": [10_000, 30_000],
  "300-plus": [30_001, Number.MAX_SAFE_INTEGER],
  "under-500": [0, 49_999],
  "500-1000": [50_000, 100_000],
  "1000+": [100_001, Number.MAX_SAFE_INTEGER],
  "1000-plus": [100_001, Number.MAX_SAFE_INTEGER],
};

export async function listServices(input: z.input<typeof serviceFiltersSchema> | Record<string, string> = {}) {
  const filters = serviceFiltersSchema.parse(input);
  const q = filters.q;
  const range = filters.budget ? BUDGETS[filters.budget] : undefined;
  const services = await db.service.findMany({
    where: {
      active: true,
      ...(filters.category.length ? { category: { in: filters.category } } : {}),
      ...(range ? { listPricePence: { gte: range[0], lte: range[1] } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { summary: { contains: q, mode: "insensitive" as const } },
              { code: { equals: q.toUpperCase() } },
            ],
          }
        : {}),
    },
    include: detailInclude,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return services.map(toServiceDto);
}

export async function getServiceBySlug(slug: string, { includeInactive = false } = {}) {
  const service = await db.service.findFirst({ where: { OR: [{ slug }, { code: slug.toUpperCase() }] }, include: detailInclude });
  if (!service || (!service.active && !includeInactive)) return null;
  return toServiceDto(service);
}

export async function requireService(slug: string) {
  const service = await getServiceBySlug(slug);
  if (!service) throw notFound("Service");
  return service;
}

// ─── Bundles ────────────────────────────────────────────────────────────────

const toBundleDto = (bundle: any) => ({
  id: bundle.id as string,
  code: bundle.code as string,
  slug: bundle.slug as string,
  name: bundle.name as string,
  description: bundle.description as string,
  pricePence: bundle.pricePence as number,
  discountable: bundle.discountable as boolean,
  active: bundle.active as boolean,
  services: (bundle.items ?? []).map((item: any) => ({ id: item.service.id as string, code: item.service.code as string, title: item.service.title as string, listPricePence: item.service.listPricePence as number })),
  /** What the services would cost separately, per property. */
  separatePricePence: (bundle.items ?? []).reduce((sum: number, item: any) => sum + (item.service.listPricePence as number), 0),
});

const bundleInclude = { items: { include: { service: true }, orderBy: { position: "asc" as const } } } as const;

export async function listBundles({ includeInactive = false } = {}) {
  const bundles = await db.bundle.findMany({ where: includeInactive ? {} : { active: true }, include: bundleInclude, orderBy: { createdAt: "asc" } });
  return bundles.map(toBundleDto);
}

export const bundleSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,20}$/),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().trim().min(3),
  description: z.string().trim().default(""),
  pricePence: z.number().int().positive(),
  discountable: z.boolean().default(true),
  active: z.boolean().default(true),
  serviceIds: z.array(z.string()).min(2, "A bundle needs at least two services."),
});

export async function saveBundle(actorId: string, id: string | null, input: z.input<typeof bundleSchema>) {
  const data = bundleSchema.parse(input);
  const services = await db.service.findMany({ where: { OR: [{ id: { in: data.serviceIds } }, { code: { in: data.serviceIds } }] }, select: { id: true, code: true } });
  if (services.length !== new Set(data.serviceIds).size) throw badRequest("One of the bundle's services doesn't exist.");
  const ordered = data.serviceIds.map((ref) => services.find((service: any) => service.id === ref || service.code === ref)!);
  const fields = { code: data.code, slug: data.slug ?? slugify(data.name), name: data.name, description: data.description, pricePence: data.pricePence, discountable: data.discountable, active: data.active };
  const bundle = await db.$transaction(async (tx) => {
    const saved = id ? await tx.bundle.update({ where: { id }, data: fields }) : await tx.bundle.create({ data: fields });
    await tx.bundleItem.deleteMany({ where: { bundleId: saved.id } });
    await tx.bundleItem.createMany({ data: ordered.map((service: any, position: number) => ({ bundleId: saved.id, serviceId: service.id, position })) });
    return tx.bundle.findUnique({ where: { id: saved.id }, include: bundleInclude });
  });
  await audit(actorId, id ? "bundle.update" : "bundle.create", "Bundle", bundle!.id);
  return toBundleDto(bundle);
}

// ─── Admin ──────────────────────────────────────────────────────────────────

const iconCard = z.object({ title: z.string().trim().min(1), description: z.string().trim().min(1), icon: z.string().trim().min(1) });
const conditionField = z.unknown().nullable().optional().refine((value) => value === null || value === undefined || isCondition(value), "Invalid condition.");
const keyField = z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Use letters, numbers and underscores.");

const stageInput = z.object({
  name: z.string().trim().min(1, "Name the stage."),
  description: z.string().trim().default(""),
  clientVisible: z.boolean().default(true),
  defaultRole: z.enum(STAGE_ROLES).default("COORDINATOR"),
  slaDays: z.number().int().min(0).nullable().default(null),
  boardColumn: z.enum(TASK_COLUMNS).default("BACKLOG"),
  projectStatus: z.enum(PROJECT_STATUSES).nullable().default(null),
});

const addonInput = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1),
  description: z.string().trim().default(""),
  kind: z.enum(ADDON_KINDS),
  amount: z.number().int().nonnegative(),
  freeAllowance: z.number().int().nonnegative().default(0),
  audience: z.enum(ADDON_AUDIENCES).default("ALL"),
  fastTrack: z.boolean().default(false),
  icon: z.string().trim().default("express"),
  active: z.boolean().default(true),
});

const documentInput = z.object({
  key: keyField,
  label: z.string().trim().min(1),
  required: z.boolean().default(true),
  condition: conditionField,
  timing: z.enum(DOCUMENT_TIMINGS).default("BEFORE_START"),
  acceptedTypes: z.array(z.string()).default(["PDF", "JPG", "PNG", "DOCX", "XLSX"]),
  maxBytes: z.number().int().positive().max(100 * 1024 * 1024).default(25 * 1024 * 1024),
});

export const questionInput = z.object({
  key: keyField,
  label: z.string().trim().min(1),
  help: z.string().trim().nullable().optional(),
  type: z.enum(INTAKE_FIELD_TYPES),
  options: z.array(z.object({ value: z.string().trim().min(1), label: z.string().trim().min(1) })).nullable().optional(),
  required: z.boolean().default(false),
  condition: conditionField,
  scope: z.enum(INTAKE_SCOPES).default("LINE"),
  step: z.number().int().min(0).max(10).default(0),
  active: z.boolean().default(true),
});

const deliverableInput = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().default(""),
  kind: z.enum(DELIVERABLE_KINDS).default("PDF"),
  versioned: z.boolean().default(true),
});

export const serviceInputSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,8}$/, "Use 2–8 capital letters or numbers."),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes.").optional(),
  title: z.string().trim().min(3, "Give the service a title (min 3 characters)."),
  headline: z.string().trim().optional(),
  summary: z.string().trim().min(10, "Describe the service (min 10 characters)."),
  intro: z.string().trim().optional(),
  category: z.enum(SERVICE_CATEGORIES).default("ASSESSMENT"),
  badge: z.string().trim().default("PAS 2035"),
  schemes: z.array(z.enum(SCHEMES)).default([]),

  priceUnit: z.enum(PRICE_UNITS).default("PROPERTY"),
  listPricePence: z.number().int().positive("Set a list price."),
  siteVisit: z.enum(SITE_VISIT).default("NONE"),
  standardDays: z.number().int().min(0).nullable().default(null),
  fastTrackDays: z.number().int().min(0).nullable().default(null),
  standardLabel: z.string().trim().max(60).nullable().optional(),
  fastTrackLabel: z.string().trim().max(60).nullable().optional(),
  revisionRounds: z.number().int().min(0).max(10).default(2),
  discountable: z.boolean().default(true),
  requiresProperty: z.boolean().default(true),

  imageUrl: z.string().trim().default("/images/services/whole-house-facade.webp"),
  gallery: z.array(z.string().trim()).default([]),
  overview: z.object({ paragraphs: z.array(z.string()), keyAreas: z.array(z.string()) }).optional(),
  included: z.array(z.string().trim().min(1)).default([]),
  compliance: z.array(iconCard).default([]),
  deliverablesInfo: z.array(iconCard).default([]),
  active: z.boolean().default(true),
  position: z.number().int().optional(),

  stages: z.array(stageInput).min(2, "Add the workflow stages (at least two)."),
  addons: z.array(addonInput).default([]),
  documents: z.array(documentInput).default([]),
  questions: z.array(questionInput).default([]),
  serviceDeliverables: z.array(deliverableInput).default([]),
});

export type ServiceInput = z.input<typeof serviceInputSchema>;

export const servicePatchSchema = z
  .object({
    active: z.boolean(),
    position: z.number().int(),
    title: z.string().trim().min(3),
    summary: z.string().trim().min(10),
    listPricePence: z.number().int().positive(),
    standardDays: z.number().int().min(0).nullable(),
    fastTrackDays: z.number().int().min(0).nullable(),
    standardLabel: z.string().trim().max(60).nullable(),
    fastTrackLabel: z.string().trim().max(60).nullable(),
    revisionRounds: z.number().int().min(0).max(10),
    discountable: z.boolean(),
    imageUrl: z.string().trim().min(1),
  })
  .partial();

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "service"
  );
}

async function uniqueSlug(base: string, ignoreId?: string) {
  let slug = base;
  for (let suffix = 2; ; suffix++) {
    const clash = await db.service.findUnique({ where: { slug }, select: { id: true } });
    if (!clash || clash.id === ignoreId) return slug;
    slug = `${base}-${suffix}`;
  }
}

function serviceFields(data: z.output<typeof serviceInputSchema>) {
  const questionKeys = data.questions.map((question) => question.key);
  if (new Set(questionKeys).size !== questionKeys.length) throw badRequest("Two questions share the same key.");
  const documentKeys = data.documents.map((doc) => doc.key);
  if (new Set(documentKeys).size !== documentKeys.length) throw badRequest("Two documents share the same key.");
  return {
    code: data.code,
    title: data.title,
    headline: data.headline || data.title,
    summary: data.summary,
    intro: data.intro || data.summary,
    category: data.category,
    badge: data.badge,
    schemes: data.schemes,
    priceUnit: data.priceUnit,
    listPricePence: data.listPricePence,
    siteVisit: data.siteVisit,
    standardDays: data.standardDays,
    fastTrackDays: data.fastTrackDays,
    standardLabel: data.standardLabel ?? null,
    fastTrackLabel: data.fastTrackLabel ?? null,
    revisionRounds: data.revisionRounds,
    discountable: data.discountable,
    requiresProperty: data.requiresProperty,
    imageUrl: data.imageUrl,
    gallery: data.gallery.length ? data.gallery : [data.imageUrl],
    overview: data.overview ?? { paragraphs: [data.summary], keyAreas: [] },
    included: data.included,
    compliance: data.compliance,
    deliverablesInfo: data.deliverablesInfo,
    active: data.active,
    ...(data.position !== undefined ? { position: data.position } : {}),
  };
}

const json = (value: unknown) => (value === undefined || value === null ? undefined : (value as never));
/** For updates: an empty condition must clear the column, not leave it unchanged. */
const jsonOrNull = (value: unknown) => (value === undefined || value === null ? (Prisma.DbNull as never) : (value as never));

export async function listServicesForAdmin() {
  const services = await db.service.findMany({
    include: { ...detailInclude, addons: { orderBy: { position: "asc" } }, _count: { select: { orderLines: true } } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return services.map((service: any) => ({
    ...toServiceDto(service),
    orders: service._count.orderLines as number,
    deliverableCount: service.deliverables.length as number,
  }));
}

export async function getServiceForAdmin(id: string) {
  const service = await db.service.findUnique({ where: { id }, include: { ...detailInclude, addons: { orderBy: { position: "asc" } }, questions: { orderBy: [{ step: "asc" }, { position: "asc" }] } } });
  if (!service) throw notFound("Service");
  return toServiceDto(service);
}

export async function createService(actorId: string, input: ServiceInput) {
  const data = serviceInputSchema.parse(input);
  if (await db.service.findUnique({ where: { code: data.code }, select: { id: true } })) throw badRequest(`Service code ${data.code} is already used.`);
  const slug = await uniqueSlug(data.slug ?? slugify(data.title));
  const service = await db.service.create({
    data: {
      slug,
      ...serviceFields(data),
      stages: { create: data.stages.map((stage, position) => ({ ...stage, position })) },
      addons: { create: data.addons.map((addon, position) => ({ ...addon, position })) },
      documentRequirements: { create: data.documents.map((doc, position) => ({ ...doc, condition: json(doc.condition), position })) },
      questions: { create: data.questions.map((question, position) => ({ ...question, help: question.help ?? null, options: json(question.options), condition: json(question.condition), position })) },
      deliverables: { create: data.serviceDeliverables.map((item, position) => ({ ...item, position })) },
    },
    include: detailInclude,
  });
  await audit(actorId, "service.create", "Service", service.id);
  return toServiceDto(service);
}

/**
 * Full replace. Add-ons and documents are matched by key so historical orders keep their
 * links; stages, questions and deliverable templates are rebuilt (projects keep their own
 * copies). Existing orders never change: they hold snapshots.
 */
export async function replaceService(actorId: string, id: string, input: ServiceInput) {
  const data = serviceInputSchema.parse(input);
  const existing = await db.service.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existing) throw notFound("Service");
  const clash = await db.service.findUnique({ where: { code: data.code }, select: { id: true } });
  if (clash && clash.id !== id) throw badRequest(`Service code ${data.code} is already used.`);
  const slug = data.slug ? await uniqueSlug(data.slug, id) : existing.slug;

  await db.$transaction(async (tx) => {
    await tx.service.update({ where: { id }, data: { slug, ...serviceFields(data) } });

    await tx.serviceStage.deleteMany({ where: { serviceId: id } });
    await tx.serviceStage.createMany({ data: data.stages.map((stage, position) => ({ ...stage, serviceId: id, position })) });

    for (const [position, addon] of data.addons.entries()) {
      await tx.serviceAddon.upsert({ where: { serviceId_key: { serviceId: id, key: addon.key } }, create: { serviceId: id, ...addon, position }, update: { ...addon, position } });
    }
    // Add-ons referenced by orders are deactivated rather than deleted.
    await tx.serviceAddon.updateMany({ where: { serviceId: id, key: { notIn: data.addons.map((addon) => addon.key) } }, data: { active: false } });

    for (const [position, doc] of data.documents.entries()) {
      const row = { label: doc.label, required: doc.required, condition: jsonOrNull(doc.condition), timing: doc.timing, acceptedTypes: doc.acceptedTypes, maxBytes: doc.maxBytes, position };
      await tx.serviceDocumentRequirement.upsert({ where: { serviceId_key: { serviceId: id, key: doc.key } }, create: { serviceId: id, key: doc.key, ...row }, update: row });
    }
    await tx.serviceDocumentRequirement.deleteMany({ where: { serviceId: id, key: { notIn: data.documents.map((doc) => doc.key) } } });

    await tx.intakeQuestion.deleteMany({ where: { serviceId: id } });
    for (const [position, question] of data.questions.entries()) {
      await tx.intakeQuestion.create({ data: { ...question, help: question.help ?? null, options: json(question.options), condition: json(question.condition), serviceId: id, position } });
    }

    await tx.serviceDeliverable.deleteMany({ where: { serviceId: id } });
    await tx.serviceDeliverable.createMany({ data: data.serviceDeliverables.map((item, position) => ({ ...item, serviceId: id, position })) });
  });
  await audit(actorId, "service.update", "Service", id);
  return getServiceForAdmin(id);
}

export async function patchService(actorId: string, id: string, input: z.input<typeof servicePatchSchema>) {
  const data = servicePatchSchema.parse(input);
  const service = await db.service.update({ where: { id }, data, include: detailInclude }).catch(() => null);
  if (!service) throw notFound("Service");
  await audit(actorId, "service.patch", "Service", id, data);
  return toServiceDto(service);
}

/** Delete, or deactivate when orders reference the service. */
export async function deleteService(actorId: string, id: string) {
  const service = await db.service.findUnique({ where: { id }, select: { id: true, _count: { select: { orderLines: true, bundleItems: true } } } });
  if (!service) throw notFound("Service");
  if (service._count.orderLines > 0 || service._count.bundleItems > 0) {
    await db.service.update({ where: { id }, data: { active: false } });
    await audit(actorId, "service.deactivate", "Service", id);
    return { deleted: false, deactivated: true };
  }
  await db.service.delete({ where: { id } });
  await audit(actorId, "service.delete", "Service", id);
  return { deleted: true, deactivated: false };
}

// ─── Common intake questions (serviceId = null) ─────────────────────────────

export async function listCommonQuestions() {
  const rows = (await db.intakeQuestion.findMany({ where: { serviceId: null }, orderBy: [{ step: "asc" }, { position: "asc" }] })) as QuestionRow[];
  return rows.map((row) => ({ ...toQuestionDto(row), active: (row as unknown as { active: boolean }).active }));
}

export async function replaceCommonQuestions(actorId: string, input: unknown) {
  const questions = z.array(questionInput).parse(input);
  const keys = questions.map((question) => question.key);
  if (new Set(keys).size !== keys.length) throw badRequest("Two questions share the same key.");
  await db.$transaction(async (tx) => {
    await tx.intakeQuestion.deleteMany({ where: { serviceId: null } });
    for (const [position, question] of questions.entries()) {
      await tx.intakeQuestion.create({ data: { ...question, help: question.help ?? null, options: json(question.options), condition: json(question.condition), serviceId: null, position } });
    }
  });
  await audit(actorId, "intake.common.replace", "IntakeQuestion", undefined, { count: questions.length });
  return listCommonQuestions();
}
