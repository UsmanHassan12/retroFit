/** View models for the client portal. Built from the API DTOs in features/projects/queries.ts. */
export type ProjectStage = "Assessment" | "Design" | "Coordination" | "Installation" | "Completed";

export type Person = { name: string; role: string; email?: string; avatar?: string };

export type ProjectDocument = { id: string; name: string; version: number; uploadedAt: string; href: string };

/** sentAt is an ISO timestamp; the chat formats it. */
export type ProjectMessage = { id: string; author: Person; body: string; sentAt: string; mine: boolean };

export type ProjectMilestone = {
  title: string;
  date?: string;
  status: "done" | "current" | "upcoming";
};

export type ProjectDeliverable = {
  id: string;
  title: string;
  description: string;
  kind: "pdf" | "spreadsheet" | "report";
  available: boolean;
  href?: string;
};

export type ProjectActivity = { id: string; title: string; actor: string; at: string };

export type Project = {
  id: string;
  title: string;
  service: string;
  address: { line1: string; city: string; postcode: string };
  scheme: "ECO4" | "GBIS" | null;
  stage: ProjectStage;
  progress: number;
  image: string;
  coordinator: Person;
  phase: { name: string; description: string; notice?: string };
  activity: ProjectActivity[];
  documents: ProjectDocument[];
  messages: ProjectMessage[];
  milestones: ProjectMilestone[];
  deliverables: ProjectDeliverable[];
  createdAt: string;
};
