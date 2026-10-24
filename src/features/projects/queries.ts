import { cache } from "react";

import { CLIENT_STATS, CURRENT_CLIENT, PROJECTS } from "./data";
import type { Project } from "./types";

export type ProjectFilter = "all" | "active" | "completed";

export const isActive = (project: Project) => project.stage !== "Completed";

export async function getClientProjects(filter: ProjectFilter = "all", q?: string): Promise<Project[]> {
  const query = q?.trim().toLowerCase();
  return PROJECTS.filter((project) => {
    if (filter === "active" && !isActive(project)) return false;
    if (filter === "completed" && isActive(project)) return false;
    if (query) {
      const haystack = `${project.id} ${project.address.line1} ${project.address.city} ${project.service}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** Memoised per request so the project layout and tab pages share one lookup. */
export const getProject = cache(async (id: string): Promise<Project | undefined> => {
  return PROJECTS.find((project) => project.id === id);
});

export async function getClientOverview() {
  const active = PROJECTS.filter(isActive);
  return {
    client: CURRENT_CLIENT,
    activeProjects: active,
    stats: {
      active: active.length,
      completed: PROJECTS.length - active.length,
      fundingSecured: CLIENT_STATS.fundingSecured,
      compliance: CLIENT_STATS.compliance,
    },
  };
}

export async function getClientProfile() {
  return CURRENT_CLIENT;
}
