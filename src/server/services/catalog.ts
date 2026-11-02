import "server-only";

import { z } from "zod";

import { db } from "../db";
import { SCHEMES, SERVICE_CATEGORIES } from "../domain";
import { badRequest, notFound } from "../errors";
import { audit } from "./audit";

/** Everything the storefront needs for one service. */
const detailInclude = {
  tiers: { orderBy: { position: "asc" } },
  addons: { where: { active: true }, orderBy: { position: "asc" } },
  milestones: { orderBy: { position: "asc" } },
} as const;

type IconCard = { title: string; description: string; icon: string };

/** Public JSON shape (pence). The frontend adapter turns this into its view model. */
export function toServiceDto(service: any) {
  const tiers = (service.tiers ?? []).map((tier: any) => ({
    id: tier.id,
    key: tier.key,
    name: tier.name,
    pricePence: tier.pricePence,
    summary: tier.summary,
    deliveryDays: tier.deliveryDays,
    inclusions: tier.inclusions,
    highlights: tier.highlights,
    deliverables: tier.deliverables,
  }));
  return {
    id: service.id as string,
    slug: service.slug as string,
    title: service.title as string,
    headline: service.headline as string,
    summary: service.summary as string,
    intro: service.intro as string,
    category: service.category as string,
    badge: service.badge as string,
    schemes: service.schemes as string[],
    turnaround: service.turnaround as string,
    imageUrl: service.imageUrl as string,
    gallery: service.gallery as string[],
    active: service.active as boolean,
    fromPricePence: tiers.length ? Math.min(...tiers.map((tier: { pricePence: number }) => tier.pricePence)) : 0,
    tiers,
    addons: (service.addons ?? []).map((addon: any) => ({
      id: addon.id,
      key: addon.key,
      name: addon.name,
      description: addon.description,
      pricePence: addon.pricePence,
      icon: addon.icon,
    })),
    timeline: (service.milestones ?? []).map((milestone: any) => ({ title: milestone.title, description: milestone.description })),
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
  budget: z.enum(["under-500", "500-1000", "1000+", "1000-plus"]).optional(),
});

const BUDGETS = {
  "under-500": [0, 49_999],
  "500-1000": [50_000, 100_000],
  "1000+": [100_001, Number.MAX_SAFE_INTEGER],
  "1000-plus": [100_001, Number.MAX_SAFE_INTEGER],
} as const;

export async function listServices(input: z.input<typeof serviceFiltersSchema> | Record<string, string> = {}) {
  const filters = serviceFiltersSchema.parse(input);
  const q = filters.q?.toLowerCase();
  const services = await db.service.findMany({
    where: {
      active: true,
      ...(filters.category.length ? { category: { in: filters.category } } : {}),
      ...(q
        ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { summary: { contains: q, mode: "insensitive" as const } }] }
        : {}),
    },
    include: detailInclude,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const dtos = services.map(toServiceDto);
  if (!filters.budget) return dtos;
  const [min, max] = BUDGETS[filters.budget];
  return dtos.filter((service: ServiceDto) => service.fromPricePence >= min && service.fromPricePence <= max);
}

export async function getServiceBySlug(slug: string, { includeInactive = false } = {}) {
  const service = await db.service.findUnique({ where: { slug }, include: detailInclude });
  if (!service || (!service.active && !includeInactive)) return null;
  return toServiceDto(service);
}

export async function requireService(slug: string) {
  const service = await getServiceBySlug(slug);
  if (!service) throw notFound("Service");
  return service;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

const iconCard = z.object({ title: z.string().trim().min(1), description: z.string().trim().min(1), icon: z.string().trim().min(1) });

const tierInput = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes.")
    .optional(),
  name: z.string().trim().min(1, "Tier name is required."),
  pricePence: z.number().int().positive("Price must be greater than 0."),
  summary: z.string().trim().default(""),
  deliveryDays: z.number().int().positive("Enter the number of days."),
  inclusions: z.array(z.string().trim().min(1)).default([]),
  highlights: z.array(z.string().trim().min(1)).default([]),
  deliverables: z.array(z.string().trim().min(1)).min(1, "Add at least one deliverable."),
});

const addonInput = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1),
  description: z.string().trim().default(""),
  pricePence: z.number().int().nonnegative(),
  icon: z.enum(["express", "review", "filing", "training"]).default("express"),
  active: z.boolean().default(true),
});

export const serviceInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes.")
    .optional(),
  title: z.string().trim().min(3, "Give the service a title (min 3 characters)."),
  headline: z.string().trim().optional(),
  summary: z.string().trim().min(10, "Describe the service (min 10 characters)."),
  intro: z.string().trim().optional(),
  category: z.enum(SERVICE_CATEGORIES).default("ASSESSMENT"),
  badge: z.string().trim().default("PAS 2035"),
  schemes: z.array(z.enum(SCHEMES)).default([]),
  turnaround: z.string().trim().optional(),
  imageUrl: z.string().trim().default("/images/services/whole-house-facade.webp"),
  gallery: z.array(z.string().trim()).default([]),
  overview: z.object({ paragraphs: z.array(z.string()), keyAreas: z.array(z.string()) }).optional(),
  included: z.array(z.string().trim().min(1)).default([]),
  compliance: z.array(iconCard).default([]),
  deliverablesInfo: z.array(iconCard).default([]),
  active: z.boolean().default(true),
  position: z.number().int().optional(),
  tiers: z.array(tierInput).min(1, "Add at least one pricing tier."),
  addons: z.array(addonInput).default([]),
  milestones: z.array(z.object({ title: z.string().trim().min(1), description: z.string().trim().default("") })).default([]),
});

export type ServiceInput = z.input<typeof serviceInputSchema>;

export const servicePatchSchema = z
  .object({
    active: z.boolean(),
    position: z.number().int(),
    title: z.string().trim().min(3),
    summary: z.string().trim().min(10),
    turnaround: z.string().trim().min(1),
    imageUrl: z.string().trim().min(1),
  })
  .partial();

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "service";

const tierKeyFor = (index: number, name: string) => (index < 3 ? ["basic", "standard", "premium"][index]! : slugify(name));

async function uniqueSlug(base: string, ignoreId?: string) {
  let slug = base;
  for (let suffix = 2; ; suffix++) {
    const clash = await db.service.findUnique({ where: { slug }, select: { id: true } });
    if (!clash || clash.id === ignoreId) return slug;
    slug = `${base}-${suffix}`;
  }
}

function serviceFields(data: z.output<typeof serviceInputSchema>) {
  const fastest = Math.min(...data.tiers.map((tier) => tier.deliveryDays));
  return {
    title: data.title,
    headline: data.headline || data.title,
    summary: data.summary,
    intro: data.intro || data.summary,
    category: data.category,
    badge: data.badge,
    schemes: data.schemes,
    turnaround: data.turnaround || `${fastest} working day${fastest === 1 ? "" : "s"}`,
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

const tierRow = (tier: z.output<typeof tierInput>, index: number) => ({
  key: tier.key ?? tierKeyFor(index, tier.name),
  name: tier.name,
  pricePence: tier.pricePence,
  summary: tier.summary,
  deliveryDays: tier.deliveryDays,
  inclusions: tier.inclusions,
  highlights: tier.highlights.length ? tier.highlights : tier.deliverables.slice(0, 4),
  deliverables: tier.deliverables,
  position: index,
});

export async function listServicesForAdmin() {
  const services = await db.service.findMany({
    include: { tiers: { orderBy: { position: "asc" } }, _count: { select: { orders: true } } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return services.map((service: any) => ({
    ...toServiceDto(service),
    orders: service._count.orders as number,
    deliverableCount: Math.max(0, ...service.tiers.map((tier: any) => tier.deliverables.length as number)),
  }));
}

export async function getServiceForAdmin(id: string) {
  const service = await db.service.findUnique({
    where: { id },
    include: { tiers: { orderBy: { position: "asc" } }, addons: { orderBy: { position: "asc" } }, milestones: { orderBy: { position: "asc" } } },
  });
  if (!service) throw notFound("Service");
  return toServiceDto(service);
}

export async function createService(actorId: string, input: ServiceInput) {
  const data = serviceInputSchema.parse(input);
  const slug = await uniqueSlug(data.slug ?? slugify(data.title));
  const service = await db.service.create({
    data: {
      slug,
      ...serviceFields(data),
      tiers: { create: data.tiers.map(tierRow) },
      addons: { create: data.addons.map((addon, position) => ({ ...addon, position })) },
      milestones: { create: data.milestones.map((milestone, position) => ({ ...milestone, position })) },
    },
    include: detailInclude,
  });
  await audit(actorId, "service.create", "Service", service.id);
  return toServiceDto(service);
}

/** Full replace. Tiers / add-ons are matched by key so historical orders keep their links. */
export async function replaceService(actorId: string, id: string, input: ServiceInput) {
  const data = serviceInputSchema.parse(input);
  const existing = await db.service.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existing) throw notFound("Service");
  const slug = data.slug ? await uniqueSlug(data.slug, id) : existing.slug;
  const tiers = data.tiers.map(tierRow);
  const addonKeys = data.addons.map((addon) => addon.key);

  await db.$transaction(async (tx) => {
    await tx.service.update({ where: { id }, data: { slug, ...serviceFields(data) } });

    for (const tier of tiers) {
      await tx.serviceTier.upsert({ where: { serviceId_key: { serviceId: id, key: tier.key } }, create: { serviceId: id, ...tier }, update: tier });
    }
    const staleTiers = await tx.serviceTier.findMany({
      where: { serviceId: id, key: { notIn: tiers.map((tier) => tier.key) } },
      select: { id: true, _count: { select: { orders: true } } },
    });
    const removable = staleTiers.filter((tier: any) => tier._count.orders === 0).map((tier: any) => tier.id as string);
    if (removable.length) await tx.serviceTier.deleteMany({ where: { id: { in: removable } } });
    if (removable.length !== staleTiers.length) {
      throw badRequest("A tier that has existing orders can't be removed. Keep it, or deactivate the service instead.");
    }

    for (const [position, addon] of data.addons.entries()) {
      await tx.serviceAddon.upsert({
        where: { serviceId_key: { serviceId: id, key: addon.key } },
        create: { serviceId: id, ...addon, position },
        update: { ...addon, position },
      });
    }
    // Add-ons referenced by orders are deactivated rather than deleted.
    await tx.serviceAddon.updateMany({ where: { serviceId: id, key: { notIn: addonKeys } }, data: { active: false } });

    await tx.serviceMilestone.deleteMany({ where: { serviceId: id } });
    if (data.milestones.length) {
      await tx.serviceMilestone.createMany({ data: data.milestones.map((milestone, position) => ({ serviceId: id, ...milestone, position })) });
    }
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
  const service = await db.service.findUnique({ where: { id }, select: { id: true, _count: { select: { orders: true } } } });
  if (!service) throw notFound("Service");
  if (service._count.orders > 0) {
    await db.service.update({ where: { id }, data: { active: false } });
    await audit(actorId, "service.deactivate", "Service", id);
    return { deleted: false, deactivated: true };
  }
  await db.service.delete({ where: { id } });
  await audit(actorId, "service.delete", "Service", id);
  return { deleted: true, deactivated: false };
}
