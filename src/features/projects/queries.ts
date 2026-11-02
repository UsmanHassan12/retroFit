import "server-only";

import { cache } from "react";

import { formatRelative, formatShortDate } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { isAppError } from "@/server/errors";
import { getProfile } from "@/server/services/account";
import { listDeliverables } from "@/server/services/deliverables";
import { listDocuments } from "@/server/services/documents";
import { listMessages } from "@/server/services/messages";
import {
  clientDashboard,
  getProject as getProjectDto,
  listProjects,
  type PersonDto,
  type ProjectDetailDto,
  type ProjectSummaryDto,
} from "@/server/services/projects";
import type { ProjectPhase } from "@/server/domain";

import type { Person, Project, ProjectStage } from "./types";

/**
 * Client-portal queries: thin adapters from the backend services (src/server/services) to
 * the view models the pages render. Every call is scoped to the signed-in user.
 */

export type ProjectFilter = "all" | "active" | "completed";

const STAGE: Record<ProjectPhase, ProjectStage> = {
  PURCHASED: "Assessment",
  ASSESSMENT: "Assessment",
  SURVEY: "Assessment",
  DESIGN: "Design",
  COORDINATION: "Coordination",
  INSTALLATION: "Installation",
  QA: "Installation",
  COMPLETED: "Completed",
};

const ROLE_LABEL: Record<string, string> = {
  CLIENT: "Client",
  ASSESSOR: "Assessor",
  DESIGNER: "Designer",
  COORDINATOR: "Coordinator",
  ADMIN: "Admin",
};

export const toPersonView = (person: PersonDto | null, fallback = "Coordinator"): Person =>
  person
    ? { name: person.name, role: ROLE_LABEL[person.role] ?? person.role, email: person.email, avatar: person.avatarUrl ?? undefined }
    : { name: "Being assigned", role: fallback };

function toProjectView(project: ProjectSummaryDto): Project {
  return {
    id: project.reference,
    title: project.title,
    service: project.service.title,
    address: {
      line1: project.property?.line1 ?? "Property to be confirmed",
      city: project.property?.city ?? "",
      postcode: project.property?.postcode ?? "",
    },
    scheme: project.scheme === "ECO4" || project.scheme === "GBIS" ? project.scheme : null,
    stage: STAGE[project.phase],
    progress: project.progress,
    image: project.imageUrl,
    coordinator: toPersonView(project.coordinator),
    phase: { name: project.phaseLabel, description: "" },
    activity: [],
    documents: [],
    messages: [],
    milestones: [],
    deliverables: [],
    createdAt: project.createdAt,
  };
}

export const isActive = (project: Project) => project.stage !== "Completed";

export async function getClientProjects(filter: ProjectFilter = "all", q?: string): Promise<Project[]> {
  const user = await requireUser();
  const projects = await listProjects(user, { status: filter, q: q || undefined });
  return projects.map(toProjectView);
}

/** Full project for the detail tabs. Memoised per request (layout + metadata share it). */
export const getProject = cache(async (reference: string): Promise<Project | undefined> => {
  const user = await requireUser();
  let detail: ProjectDetailDto;
  try {
    detail = await getProjectDto(user, reference);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") return undefined;
    throw error;
  }
  const [documents, messages, deliverables] = await Promise.all([
    listDocuments(user, reference),
    listMessages(user, reference),
    listDeliverables(user, reference),
  ]);
  const base = `/api/projects/${encodeURIComponent(detail.reference)}`;

  return {
    ...toProjectView(detail),
    phase: {
      name: detail.phaseLabel,
      description: detail.phaseDescription ?? "Your project team is working on this phase. We’ll update you here as it progresses.",
      notice: detail.phaseNotice ?? undefined,
    },
    activity: detail.activity.map((item) => ({ id: item.id, title: item.message, actor: item.actor?.name ?? "Retrofit Portal", at: formatRelative(item.at) })),
    documents: documents.map((doc) => ({
      id: doc.id,
      name: doc.fileName,
      version: doc.version,
      uploadedAt: formatRelative(doc.uploadedAt),
      href: `${base}/documents/${doc.id}?download=1`,
    })),
    messages: messages.map((message) => ({
      id: message.id,
      author: toPersonView(message.author),
      body: message.body,
      sentAt: message.sentAt,
      mine: message.mine,
    })),
    // The client timeline hides the internal QA step.
    milestones: detail.milestones
      .filter((milestone) => milestone.phase !== "QA")
      .map((milestone) => ({
        title: milestone.title,
        date: milestone.completedAt ? formatShortDate(milestone.completedAt) : undefined,
        status: milestone.status.toLowerCase() as "done" | "current" | "upcoming",
      })),
    deliverables: deliverables.map((item) => ({
      id: item.id,
      title: item.title,
      description:
        item.status === "AVAILABLE"
          ? item.description
          : item.estimatedAt
            ? `In progress • Est. ${formatShortDate(item.estimatedAt)}`
            : item.status === "IN_PROGRESS"
              ? "In progress"
              : "Available after delivery",
      kind: item.kind.toLowerCase() as "pdf" | "spreadsheet" | "report",
      available: item.status === "AVAILABLE",
      href: item.status === "AVAILABLE" ? `${base}/deliverables/${item.id}/download` : undefined,
    })),
  };
});

export async function getClientOverview() {
  const user = await requireUser();
  const dashboard = await clientDashboard(user);
  return {
    activeProjects: dashboard.activeProjects.map(toProjectView),
    stats: {
      active: dashboard.stats.activeProjects,
      completed: dashboard.stats.completedProjects,
      fundingSecured: dashboard.stats.fundingSecuredPence / 100,
      compliance: dashboard.stats.compliancePercent,
    },
  };
}

/** Profile page + topbar avatar. */
export async function getClientProfile() {
  const user = await requireUser();
  const profile = await getProfile(user);
  const property = profile.properties[0] ?? null;
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone ?? "",
    avatar: profile.avatarUrl ?? undefined,
    pushNotifications: profile.pushNotifications,
    property: property
      ? {
          id: property.id,
          address: [property.line1, property.line2, property.city, property.postcode, property.country].filter(Boolean).join(", "),
          line1: property.line1,
          city: property.city,
          postcode: property.postcode,
          type: property.propertyType,
          epcNumber: property.epcNumber ?? "",
          verified: property.verified,
        }
      : null,
  };
}
export type ClientProfile = Awaited<ReturnType<typeof getClientProfile>>;
