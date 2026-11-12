import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/server/auth/session";
import * as catalog from "@/server/services/catalog";
import type { ServiceDto } from "@/server/services/catalog";
import { discountFor, getCustomerContext } from "@/server/services/customers";
import { getSettings } from "@/server/services/settings";

import { BUDGET_RANGES, SERVICE_CATEGORIES, type BudgetRange, type Service, type ServiceCategory } from "./types";

/**
 * Storefront queries: adapters from the catalogue service (src/server/services/catalog.ts,
 * prices in pence) to the view model the marketing pages render (prices in pounds).
 */

export type ServiceFilters = {
  q?: string;
  category?: ServiceCategory;
  budget?: BudgetRange;
};

/** List price per unit (pounds). */
export const startingPrice = (service: Service) => service.pricing.listPrice;

const pounds = (pence: number) => pence / 100;

export function toServiceView(dto: ServiceDto): Service {
  return {
    id: dto.id,
    code: dto.code,
    slug: dto.slug,
    title: dto.title,
    headline: dto.headline,
    summary: dto.summary,
    intro: dto.intro,
    category: dto.category.toLowerCase().replace(/_/g, "-") as ServiceCategory,
    badge: dto.badge === "Funding" ? "Funding" : "PAS 2035",
    schemes: dto.schemes,
    turnaround: dto.turnaround,
    fastTrackTurnaround: dto.fastTrackTurnaround,
    image: dto.imageUrl,
    gallery: dto.gallery.length ? dto.gallery : [dto.imageUrl],
    pricing: {
      unit: dto.pricing.unit,
      unitLabel: dto.pricing.unitLabel,
      unitLabelPlural: dto.pricing.unitLabelPlural,
      listPrice: pounds(dto.pricing.listPricePence),
      perUnit: dto.pricing.unit === "ELEMENT" || dto.pricing.unit === "JUNCTION" || dto.pricing.unit === "VISIT",
      siteVisit: dto.pricing.siteVisit as Service["pricing"]["siteVisit"],
      requiresProperty: dto.pricing.requiresProperty,
      revisionRounds: dto.pricing.revisionRounds,
    },
    addOns: dto.addons.map((addon: ServiceDto["addons"][number]) => ({
      id: addon.key,
      name: addon.name,
      description: addon.description,
      kind: addon.kind as Service["addOns"][number]["kind"],
      amount: addon.kind === "PERCENT_OF_LIST" ? addon.amount / 100 : pounds(addon.amount),
      freeAllowance: addon.freeAllowance,
      audience: addon.audience as Service["addOns"][number]["audience"],
      fastTrack: addon.fastTrack,
      icon: (["express", "review", "filing", "training"].includes(addon.icon) ? addon.icon : "express") as Service["addOns"][number]["icon"],
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

/** What the signed-in visitor pays: tier and their partner discount for this service. */
export const getBuyerPricing = cache(async (serviceId: string) => {
  const user = await getCurrentUser();
  const [context, settings] = await Promise.all([getCustomerContext(user?.id), getSettings()]);
  return {
    signedIn: Boolean(user),
    tier: context.tier,
    discountPercent: discountFor(context, serviceId, settings) / 100,
    vatPercent: settings.vat.rateBps / 100,
  };
});

export const isServiceCategory = (value: unknown): value is ServiceCategory =>
  SERVICE_CATEGORIES.some((category) => category.id === value);

export const isBudgetRange = (value: unknown): value is BudgetRange =>
  BUDGET_RANGES.some((range) => range.id === value);
