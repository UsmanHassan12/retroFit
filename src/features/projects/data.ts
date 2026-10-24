import type { Person, Project, ProjectStage } from "./types";

/** Seed data for the client portal. Replace with the projects API. */

export const CURRENT_CLIENT = {
  firstName: "Sarah",
  lastName: "Jenkins",
  email: "sarah.jenkins@example.co.uk",
  phone: "+44 7700 900123",
  avatar: "/images/avatars/sarah.webp",
  property: {
    address: "12–14 Kingsway Court, Hove, BN3 2LP, United Kingdom",
    type: "Mid Terrace Flat",
    epcNumber: "8821-0293-1402-4211-1025",
    verified: true,
  },
};

const coordinator: Person = {
  name: "John Hopkins",
  role: "Coordinator",
  email: "john.hopkins@stepsoft.co.uk",
  avatar: "/images/avatars/john-hopkins.webp",
};

const client: Person = { name: "Sarah Jenkins", role: "Client", avatar: "/images/avatars/sarah.webp" };

const baseProject = {
  coordinator,
  scheme: "ECO4" as const,
  activity: [
    { id: "a1", title: "Technical Survey Uploaded", actor: "Mike Ross", at: "2h ago" },
    { id: "a2", title: "Comment on Invoice #902", actor: "Sarah Jenkins", at: "5h ago" },
    { id: "a3", title: "Site visit confirmed for Thursday", actor: "John Hopkins", at: "1d ago" },
  ],
  documents: [
    { id: "d1", name: "Current EPC.pdf", version: 1, uploadedAt: "Today" },
    { id: "d2", name: "Floor Plan.pdf", version: 2, uploadedAt: "Yesterday" },
    { id: "d3", name: "Proof of Ownership.pdf", version: 1, uploadedAt: "12 May 2026" },
  ],
  messages: [
    { id: "m1", author: coordinator, body: "Hi Sarah, EPC received. Reviewing now.", sentAt: "14:22", mine: false },
    { id: "m2", author: client, body: "Okay, thank you!", sentAt: "14:24", mine: true },
  ],
  milestones: [
    { title: "Purchase Completed", date: "12/05/2026", status: "done" as const },
    { title: "Assessment", date: "19/05/2026", status: "done" as const },
    { title: "Survey", status: "current" as const },
    { title: "Installation", status: "upcoming" as const },
  ],
  deliverables: [
    {
      id: "r1",
      title: "EPC Pre-Retrofit Report",
      description: "Baseline energy performance certificate.",
      kind: "pdf" as const,
      available: true,
    },
    {
      id: "r2",
      title: "Funding Assessment #V2",
      description: "ECO4 contribution breakdown.",
      kind: "spreadsheet" as const,
      available: true,
    },
    {
      id: "r3",
      title: "Technical Survey Report",
      description: "In progress • Est. 5 July",
      kind: "report" as const,
      available: false,
    },
  ],
  phase: {
    name: "Technical Survey",
    description:
      "Certified assessors are validating property dimensions and thermal retention capabilities to finalise the heat pump specification.",
    notice: "Requires coordinator sign-off before proceeding to procurement.",
  },
};

const make = (
  id: string,
  line1: string,
  city: string,
  postcode: string,
  stage: ProjectStage,
  progress: number,
  image: string,
  service = "Deep Retrofit & Solar Installation",
): Project => ({
  ...baseProject,
  id,
  title: "High-Efficiency Heat Pump Installation Cluster",
  service,
  address: { line1, city, postcode },
  stage,
  progress,
  image,
  createdAt: "2026-05-12",
});

export const PROJECTS: Project[] = [
  make("RET-2026-0042", "124 Oakwood Crescent", "London", "NW10 6RF", "Assessment", 65, "/images/services/solar-roof.webp"),
  make("RET-2026-0057", "42 Maple Avenue", "Manchester", "M14 5TQ", "Design", 45, "/images/dashboard/project-terrace.webp"),
  make("RET-2026-0063", "8 Linden Grove", "Bristol", "BS6 7RD", "Coordination", 72, "/images/dashboard/project-modern.webp"),
  make("RET-2026-0018", "17 Harbour Street", "Leeds", "LS1 4AB", "Completed", 100, "/images/marketing/step-choose-service.webp", "Loft & Cavity Wall Insulation"),
  make("RET-2026-0021", "5 Church Lane", "York", "YO1 7HH", "Completed", 100, "/images/services/whole-house-facade.webp", "Whole-House Assessment"),
  make("RET-2026-0026", "91 Station Road", "Brighton", "BN1 3XE", "Completed", 100, "/images/services/facade-coordination.webp", "Air Source Heat Pump"),
  make("RET-2026-0031", "3 Mill Close", "Oxford", "OX2 6PL", "Completed", 100, "/images/marketing/step-heavy-lifting.webp", "External Wall Insulation"),
];

export const CLIENT_STATS = {
  fundingSecured: 15054,
  compliance: 100,
};
