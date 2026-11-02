import "server-only";

import { cache } from "react";

import * as catalog from "@/server/services/catalog";
import type { ServiceDto } from "@/server/services/catalog";

import {
  BUDGET_RANGES,
  SERVICE_CATEGORIES,
  type BudgetRange,
  type Service,
  type ServiceCategory,
  type TierId,
} from "./types";

/**
 * Storefront queries: adapters from the catalogue service (src/server/services/catalog.ts,
 * prices in pence) to the view model the marketing pages render (prices in pounds).
 */

export type ServiceFilters = {
  q?: string;
  category?: ServiceCategory;
  budget?: BudgetRange;
};

export const startingPrice = (service: Service) => Math.min(...service.tiers.map((tier) => tier.price));

const pounds = (pence: number) => pence / 100;

export function toServiceView(dto: ServiceDto): Service {
  return {
    slug: dto.slug,
    title: dto.title,
    headline: dto.headline,
    summary: dto.summary,
    intro: dto.intro,
    category: dto.category.toLowerCase().replace(/_/g, "-") as ServiceCategory,
    badge: dto.badge === "Funding" ? "Funding" : "PAS 2035",
    schemes: dto.schemes.filter((scheme): scheme is "ECO4" | "GBIS" => scheme === "ECO4" || scheme === "GBIS"),
    turnaround: dto.turnaround,
    image: dto.imageUrl,
    gallery: dto.gallery.length ? dto.gallery : [dto.imageUrl],
    tiers: dto.tiers.map((tier: ServiceDto["tiers"][number]) => ({
      id: tier.key as TierId,
      name: tier.name,
      price: pounds(tier.pricePence),
      summary: tier.summary,
      deliveryDays: tier.deliveryDays,
      inclusions: tier.inclusions,
      highlights: tier.highlights,
    })),
    addOns: dto.addons.map((addon: ServiceDto["addons"][number]) => ({
      id: addon.key,
      name: addon.name,
      description: addon.description,
      price: pounds(addon.pricePence),
      icon: addon.icon as Service["addOns"][number]["icon"],
    })),
    overview: dto.overview,
    included: dto.included,
    timeline: dto.timeline,
    compliance: dto.compliance as Service["compliance"],
    deliverables: dto.deliverables as Service["deliverables"],
  };
}

export async function getServices(filters: ServiceFilters = {}): Promise<Service[]> {
  const budget = BUDGET_RANGES.find((range) => range.id === filters.budget);
  const services = await catalog.listServices({ q: filters.q, category: filters.category, budget: budget?.id });
  return services.map(toServiceView);
}

export async function getFeaturedServices(limit = 3) {
  return (await getServices()).slice(0, limit);
}

/** Memoised per request: the layout, tab metadata and checkout share one lookup. */
export const getServiceBySlug = cache(async (slug: string): Promise<Service | undefined> => {
  const dto = await catalog.getServiceBySlug(slug);
  return dto ? toServiceView(dto) : undefined;
});

export const isServiceCategory = (value: unknown): value is ServiceCategory =>
  SERVICE_CATEGORIES.some((category) => category.id === value);

export const isBudgetRange = (value: unknown): value is BudgetRange =>
  BUDGET_RANGES.some((range) => range.id === value);

export const isTierId = (value: unknown): value is TierId => typeof value === "string" && /^[a-z0-9-]+$/.test(value);
