import { SERVICES } from "./data/catalog";
import {
  BUDGET_RANGES,
  SERVICE_CATEGORIES,
  type BudgetRange,
  type Service,
  type ServiceCategory,
  type TierId,
} from "./types";

/**
 * Service queries. These are async so the call sites don't change when the
 * in-memory catalogue is replaced with a fetch() to the services API.
 */

export type ServiceFilters = {
  q?: string;
  category?: ServiceCategory;
  budget?: BudgetRange;
};

export const startingPrice = (service: Service) => Math.min(...service.tiers.map((tier) => tier.price));

export async function getServices(filters: ServiceFilters = {}): Promise<Service[]> {
  const query = filters.q?.trim().toLowerCase();
  const budget = BUDGET_RANGES.find((range) => range.id === filters.budget);

  return SERVICES.filter((service) => {
    if (filters.category && service.category !== filters.category) return false;
    if (budget) {
      const price = startingPrice(service);
      if (price < budget.min || price > budget.max) return false;
    }
    if (query) {
      const haystack = `${service.title} ${service.summary} ${service.category}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export async function getFeaturedServices(limit = 3) {
  return SERVICES.slice(0, limit);
}

export async function getServiceBySlug(slug: string): Promise<Service | undefined> {
  return SERVICES.find((service) => service.slug === slug);
}

export async function getServiceSlugs() {
  return SERVICES.map((service) => service.slug);
}

export const isServiceCategory = (value: unknown): value is ServiceCategory =>
  SERVICE_CATEGORIES.some((category) => category.id === value);

export const isBudgetRange = (value: unknown): value is BudgetRange =>
  BUDGET_RANGES.some((range) => range.id === value);

export const isTierId = (value: unknown): value is TierId =>
  value === "basic" || value === "standard" || value === "premium";
