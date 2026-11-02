/**
 * Demo data matching the Figma designs. Run with `npm run db:seed`.
 *
 * ⚠ Wipes every table first so the result is predictable. It refuses to run when
 *   NODE_ENV=production unless SEED_FORCE=1 is set.
 *
 * Accounts (password Retrofit123! unless noted):
 *   admin      SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (default admin@retrofitportal.co.uk / Admin123!)
 *   client     sarah.jenkins@example.com     — owns RET-2026-0042 and six more projects
 *   staff      john.hopkins@retrofitportal.co.uk (coordinator), mike.ross@… (assessor),
 *              jane.doe@…, rob.clarke@…, marie.dubois@…, aron.patel@…
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { SERVICES } from "../src/features/services/data/catalog";
import { hashPassword } from "../src/server/auth/password";
import { PHASE_LABELS, PROJECT_PHASES, type ProjectPhase } from "../src/server/domain";

const db = new PrismaClient();

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * DAY);
const daysAhead = (days: number) => new Date(now + days * DAY);
const pence = (pounds: number) => Math.round(pounds * 100);

const CATEGORY: Record<string, string> = {
  assessment: "ASSESSMENT",
  design: "DESIGN",
  coordination: "COORDINATION",
  "full-package": "FULL_PACKAGE",
  funding: "FUNDING",
};

/** A tiny valid PDF so seeded documents can be downloaded in local-storage mode. */
const samplePdf = (title: string) =>
  `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${44 + title.length}>>stream\nBT /F1 18 Tf 72 760 Td (${title.replace(/[()\\]/g, "")}) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`;

async function storeSample(storageKey: string, title: string) {
  if (process.env.S3_BUCKET) return; // in S3 mode the keys exist only as metadata
  const file = path.join(process.cwd(), ".uploads", storageKey);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, samplePdf(title));
}

async function wipe() {
  // Children first.
  await db.auditLog.deleteMany();
  await db.activity.deleteMany();
  await db.deliverable.deleteMany();
  await db.message.deleteMany();
  await db.document.deleteMany();
  await db.task.deleteMany();
  await db.projectMilestone.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.orderAddon.deleteMany();
  await db.order.deleteMany();
  await db.invoice.deleteMany();
  await db.discountCode.deleteMany();
  await db.serviceMilestone.deleteMany();
  await db.serviceAddon.deleteMany();
  await db.serviceTier.deleteMany();
  await db.service.deleteMany();
  await db.property.deleteMany();
  await db.invite.deleteMany();
  await db.passwordResetToken.deleteMany();
  await db.emailTemplate.deleteMany();
  await db.setting.deleteMany();
  await db.counter.deleteMany();
  await db.user.deleteMany();
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    throw new Error("Refusing to wipe a production database. Set SEED_FORCE=1 if you really mean it.");
  }
  console.log("Seeding Retrofit Portal…");
  await wipe();

  // ─── Users ────────────────────────────────────────────────────────────────
  const demoHash = await hashPassword("Retrofit123!");
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@retrofitportal.co.uk").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";

  await db.user.create({
    data: { email: adminEmail, passwordHash: await hashPassword(adminPassword), firstName: "John", lastName: "Smith", role: "ADMIN", canViewAllProjects: true, lastLoginAt: new Date(), avatarUrl: "/images/avatars/profile-portrait.webp" },
  });

  const staffSpec = [
    { key: "john", firstName: "John", lastName: "Hopkins", role: "COORDINATOR", avatarUrl: "/images/avatars/john-hopkins.webp", canViewAllProjects: false },
    { key: "mike", firstName: "Mike", lastName: "Ross", role: "ASSESSOR", avatarUrl: null, canViewAllProjects: false },
    { key: "jane", firstName: "Jane", lastName: "Doe", role: "DESIGNER", avatarUrl: "/images/avatars/staff-3.webp", canViewAllProjects: false },
    { key: "rob", firstName: "Rob", lastName: "Clarke", role: "ASSESSOR", avatarUrl: "/images/avatars/staff-2.webp", canViewAllProjects: false },
    { key: "marie", firstName: "Marie", lastName: "Dubois", role: "DESIGNER", avatarUrl: "/images/avatars/staff-1.webp", canViewAllProjects: false },
    { key: "aron", firstName: "Aron", lastName: "Patel", role: "DESIGNER", avatarUrl: null, canViewAllProjects: true },
  ] as const;
  const staff: Record<string, { id: string }> = {};
  for (const [index, member] of staffSpec.entries()) {
    const { key, ...data } = member;
    staff[key] = await db.user.create({
      data: {
        ...data,
        email: `${member.firstName}.${member.lastName}@retrofitportal.co.uk`.toLowerCase(),
        passwordHash: demoHash,
        lastLoginAt: daysAgo(index * 0.7),
      },
    });
  }

  const sarah = await db.user.create({
    data: {
      email: "sarah.jenkins@example.com",
      passwordHash: demoHash,
      firstName: "Sarah",
      lastName: "Jenkins",
      phone: "+44 7700 900123",
      avatarUrl: "/images/avatars/sarah.webp",
      role: "CLIENT",
      plan: "PRIORITY",
      planRenewsAt: daysAhead(12),
      lastLoginAt: new Date(),
    },
  });

  const otherClients = await Promise.all(
    [
      ["Priya", "Shah", "customer-1"],
      ["Tom", "Whitaker", "customer-2"],
      ["Aisha", "Rahman", "customer-3"],
      ["Daniel", "Okafor", "customer-4"],
    ].map(([firstName, lastName, avatar]) =>
      db.user.create({
        data: {
          email: `${firstName}.${lastName}@example.com`.toLowerCase(),
          passwordHash: demoHash,
          firstName: firstName!,
          lastName: lastName!,
          avatarUrl: `/images/avatars/${avatar}.webp`,
          role: "CLIENT",
        },
      }),
    ),
  );

  // ─── Catalogue ────────────────────────────────────────────────────────────
  const services: Record<string, any> = {};
  for (const [position, service] of SERVICES.entries()) {
    services[service.slug] = await db.service.create({
      data: {
        slug: service.slug,
        title: service.title,
        headline: service.headline,
        summary: service.summary,
        intro: service.intro,
        category: CATEGORY[service.category] as never,
        badge: service.badge,
        schemes: service.schemes,
        turnaround: service.turnaround,
        imageUrl: service.image,
        gallery: service.gallery,
        overview: service.overview,
        included: service.included,
        compliance: service.compliance,
        deliverablesInfo: service.deliverables,
        active: true,
        position,
        tiers: {
          create: service.tiers.map((tier, index) => ({
            key: tier.id,
            name: tier.name,
            pricePence: pence(tier.price),
            summary: tier.summary,
            deliveryDays: tier.deliveryDays,
            inclusions: tier.inclusions,
            highlights: tier.highlights,
            deliverables: service.deliverables.map((item) => item.title).concat(index === 2 ? ["Post-install evaluation"] : []),
            position: index,
          })),
        },
        addons: {
          create: service.addOns.map((addon, index) => ({
            key: addon.id,
            name: addon.name,
            description: addon.description,
            pricePence: pence(addon.price),
            icon: addon.icon,
            position: index,
          })),
        },
        milestones: { create: service.timeline.map((milestone, index) => ({ ...milestone, position: index })) },
      },
      include: { tiers: true },
    });
  }

  await db.discountCode.createMany({
    data: [
      { code: "RETRO2024", percentOff: 10 },
      { code: "RETRO2026", percentOff: 10 },
      { code: "WELCOME5", percentOff: 5, maxRedemptions: 500 },
    ],
  });

  // ─── Projects ─────────────────────────────────────────────────────────────
  let orderNumber = 100;
  type Spec = {
    reference: string;
    client: { id: string };
    slug: string;
    tier: "basic" | "standard" | "premium";
    title: string;
    image?: string;
    address: [string, string, string];
    phase: ProjectPhase;
    progress: number;
    status?: "ON_TRACK" | "AT_RISK" | "DELAYED" | "COMPLETED";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "QA_REJECT";
    issue?: string;
    critical?: boolean;
    startedDaysAgo: number;
    dueInDays: number;
    team: string[];
    fundingPence?: number;
  };

  async function createProject(spec: Spec) {
    const service = services[spec.slug];
    const tier = service.tiers.find((item: any) => item.key === spec.tier);
    const property = await db.property.create({
      data: { ownerId: spec.client.id, line1: spec.address[0], city: spec.address[1], postcode: spec.address[2], propertyType: "Semi-Detached House", verified: true },
    });
    const vat = Math.round(tier.pricePence * 0.2);
    const order = await db.order.create({
      data: {
        reference: `ORD-2026-${String(++orderNumber).padStart(6, "0")}`,
        userId: spec.client.id,
        serviceId: service.id,
        tierId: tier.id,
        propertyId: property.id,
        status: "PAID" as const,
        serviceTitle: service.title,
        tierName: tier.name,
        basePence: tier.pricePence,
        addonsPence: 0,
        vatPence: vat,
        totalPence: tier.pricePence + vat,
        paidAt: daysAgo(spec.startedDaysAgo),
        createdAt: daysAgo(spec.startedDaysAgo),
      },
    });

    const phaseIndex = PROJECT_PHASES.indexOf(spec.phase);
    const completed = spec.phase === "COMPLETED";
    return db.project.create({
      data: {
        reference: spec.reference,
        orderId: order.id,
        clientId: spec.client.id,
        serviceId: service.id,
        propertyId: property.id,
        coordinatorId: staff.john!.id,
        title: spec.title,
        coverImageUrl: spec.image ?? null,
        phase: spec.phase,
        phaseDescription: completed ? "All works signed off and lodged with TrustMark." : null,
        status: spec.status ?? (completed ? ("COMPLETED" as const) : ("ON_TRACK" as const)),
        priority: spec.priority ?? "MEDIUM",
        progress: spec.progress,
        scheme: "ECO4" as const,
        fundingSecuredPence: spec.fundingPence ?? 0,
        hasIssues: Boolean(spec.issue),
        criticalIssue: Boolean(spec.critical),
        issueSummary: spec.issue ?? null,
        startedAt: daysAgo(spec.startedDaysAgo),
        createdAt: daysAgo(spec.startedDaysAgo),
        dueDate: daysAhead(spec.dueInDays),
        completedAt: completed ? daysAgo(Math.max(0, spec.startedDaysAgo - 30)) : null,
        milestones: {
          create: PROJECT_PHASES.map((phase, position) => {
            const status = completed || position < phaseIndex ? ("DONE" as const) : position === phaseIndex ? ("CURRENT" as const) : ("UPCOMING" as const);
            return {
              phase,
              title: PHASE_LABELS[phase],
              position,
              status,
              completedAt: status === "DONE" ? daysAgo(Math.max(0, spec.startedDaysAgo - position * 7)) : null,
            };
          }),
        },
        members: { create: ["john", ...spec.team].map((key) => ({ userId: staff[key]!.id })) },
        deliverables: {
          create: tier.deliverables.map((title: string) => ({
            title,
            description: completed ? "Final version issued." : "Prepared during your project.",
            kind: "PDF" as const,
            status: "PENDING" as const,
          })),
        },
      },
    });
  }

  const sarahProjects: Spec[] = [
    { reference: "RET-2026-0057", client: sarah, slug: "retrofit-design-package", tier: "standard", title: "Retrofit Design Package", image: "/images/dashboard/project-terrace.webp", address: ["42 Maple Avenue", "Manchester", "M14 5TQ"], phase: "DESIGN", progress: 45, startedDaysAgo: 40, dueInDays: 21, team: ["jane"], fundingPence: 0 },
    { reference: "RET-2026-0063", client: sarah, slug: "retrofit-coordination", tier: "standard", title: "Retrofit Coordination", image: "/images/dashboard/project-modern.webp", address: ["8 Linden Grove", "Bristol", "BS6 7RD"], phase: "COORDINATION", progress: 72, startedDaysAgo: 55, dueInDays: 14, team: ["rob"] },
    { reference: "RET-2026-0018", client: sarah, slug: "full-retrofit-package", tier: "basic", title: "Loft & Cavity Wall Insulation", image: "/images/marketing/step-choose-service.webp", address: ["17 Harbour Street", "Leeds", "LS1 4AB"], phase: "COMPLETED", progress: 100, startedDaysAgo: 160, dueInDays: -100, team: ["mike"], fundingPence: 420_000 },
    { reference: "RET-2026-0021", client: sarah, slug: "whole-house-retrofit-assessment", tier: "basic", title: "Whole-House Assessment", image: "/images/services/whole-house-facade.webp", address: ["5 Church Lane", "York", "YO1 7HH"], phase: "COMPLETED", progress: 100, startedDaysAgo: 140, dueInDays: -90, team: ["mike"], fundingPence: 0 },
    { reference: "RET-2026-0026", client: sarah, slug: "eco4-funding-application", tier: "standard", title: "Air Source Heat Pump", image: "/images/services/facade-coordination.webp", address: ["91 Station Road", "Brighton", "BN1 3XE"], phase: "COMPLETED", progress: 100, startedDaysAgo: 120, dueInDays: -60, team: ["rob"], fundingPence: 600_000 },
    { reference: "RET-2026-0031", client: sarah, slug: "thermal-energy-modelling", tier: "standard", title: "External Wall Insulation", image: "/images/marketing/step-heavy-lifting.webp", address: ["3 Mill Close", "Oxford", "OX2 6PL"], phase: "COMPLETED", progress: 100, startedDaysAgo: 100, dueInDays: -45, team: ["marie"], fundingPence: 285_400 },
  ];

  // The hero project from the designs.
  const hero = await createProject({
    reference: "RET-2026-0042",
    client: sarah,
    slug: "whole-house-retrofit-assessment",
    tier: "premium",
    title: "High-Efficiency Heat Pump Installation Cluster",
    image: "/images/services/solar-roof.webp",
    address: ["124 Oakwood Crescent", "London", "NW10 6RF"],
    phase: "SURVEY",
    progress: 65,
    startedDaysAgo: 24,
    dueInDays: 30,
    team: ["mike", "jane"],
  });
  await db.project.update({
    where: { id: hero.id },
    data: {
      phaseDescription:
        "Certified assessors are validating property dimensions and thermal retention capabilities to finalise the heat pump specification.",
      phaseNotice: "Requires coordinator sign-off before proceeding to procurement.",
    },
  });
  for (const spec of sarahProjects) await createProject(spec);

  // Sarah's primary (profile) property.
  await db.property.create({
    data: {
      ownerId: sarah.id,
      line1: "12–14 Kingsway Court",
      city: "Hove",
      postcode: "BN3 2LP",
      propertyType: "Mid Terrace Flat",
      epcNumber: "8821-0293-1402-4211-1025",
      verified: true,
      isPrimary: true,
    },
  });

  // Admin-directory projects for other clients (with issues for the priority queue).
  const others: Spec[] = [
    { reference: "RET-2026-0070", client: otherClients[0]!, slug: "whole-house-retrofit-assessment", tier: "standard", title: "HVAC Retrofit", address: ["23 Oak Avenue", "Manchester", "M20 2RN"], phase: "ASSESSMENT", progress: 20, status: "AT_RISK", priority: "HIGH", issue: "EPC report overdue", critical: true, startedDaysAgo: 3, dueInDays: -2, team: ["rob"] },
    { reference: "RET-2026-0071", client: otherClients[1]!, slug: "retrofit-design-package", tier: "basic", title: "Insulation Upgrade", address: ["7 Elm Road", "Salford", "M6 5WA"], phase: "SURVEY", progress: 40, status: "DELAYED", priority: "MEDIUM", issue: "Missing floor plan", startedDaysAgo: 18, dueInDays: 1, team: ["jane"] },
    { reference: "RET-2026-0072", client: otherClients[2]!, slug: "retrofit-design-package", tier: "premium", title: "Air Source Heat Pump", address: ["51 Park Lane", "Stockport", "SK1 3BT"], phase: "DESIGN", progress: 55, status: "AT_RISK", priority: "QA_REJECT", issue: "Design failed QA", startedDaysAgo: 30, dueInDays: 3, team: ["marie"] },
    { reference: "RET-2026-0073", client: otherClients[3]!, slug: "full-retrofit-package", tier: "standard", title: "Solar PV", address: ["12 Birch Close", "Bolton", "BL1 4QP"], phase: "ASSESSMENT", progress: 15, priority: "HIGH", issue: "Survey not scheduled", startedDaysAgo: 0, dueInDays: 4, team: [] },
    { reference: "RET-2026-0074", client: otherClients[0]!, slug: "eco4-funding-application", tier: "basic", title: "Whole-House Assessment", address: ["3 Cedar Way", "Wigan", "WN1 2DD"], phase: "COORDINATION", progress: 72, priority: "HIGH", issue: "Funding evidence pending", startedDaysAgo: 50, dueInDays: 6, team: ["aron"] },
    { reference: "RET-2026-0075", client: otherClients[1]!, slug: "retrofit-coordination", tier: "premium", title: "Installer Sign-off", address: ["88 Ash Street", "Oldham", "OL1 1HX"], phase: "INSTALLATION", progress: 85, status: "DELAYED", priority: "HIGH", issue: "Installer sign-off missing", startedDaysAgo: 75, dueInDays: 7, team: ["rob", "aron"] },
    { reference: "RET-2026-0076", client: otherClients[2]!, slug: "thermal-energy-modelling", tier: "basic", title: "Thermal Modelling", address: ["14 Willow Bank", "Leeds", "LS6 2QA"], phase: "QA", progress: 90, startedDaysAgo: 35, dueInDays: 10, team: ["marie"] },
    { reference: "RET-2026-0077", client: otherClients[3]!, slug: "whole-house-retrofit-assessment", tier: "basic", title: "Whole-House Assessment", address: ["29 Rose Hill", "Bristol", "BS5 6LT"], phase: "COMPLETED", progress: 100, startedDaysAgo: 80, dueInDays: -20, team: ["mike"], fundingPence: 320_000 },
  ];
  for (const spec of others) await createProject(spec);

  // ─── Hero project detail (activity, docs, chat, board, deliverables) ──────
  const docs = [
    { fileName: "Current EPC.pdf", version: 1, by: sarah.id, at: daysAgo(0.1) },
    { fileName: "Floor Plan.pdf", version: 1, by: sarah.id, at: daysAgo(3) },
    { fileName: "Floor Plan.pdf", version: 2, by: sarah.id, at: daysAgo(1) },
    { fileName: "Proof of Ownership.pdf", version: 1, by: sarah.id, at: daysAgo(20) },
    { fileName: "EPC Pre-Retrofit Report.pdf", version: 1, by: staff.mike!.id, at: daysAgo(10) },
    { fileName: "Funding Assessment V2.pdf", version: 1, by: staff.john!.id, at: daysAgo(6) },
  ];
  const savedDocs: Record<string, string> = {};
  for (const [index, doc] of docs.entries()) {
    const storageKey = `projects/${hero.id}/seed-${index}/${doc.fileName}`;
    const saved = await db.document.create({
      data: { projectId: hero.id, uploadedById: doc.by, fileName: doc.fileName, mimeType: "application/pdf", sizeBytes: 1200, storageKey, version: doc.version, status: "ACTIVE", createdAt: doc.at },
    });
    savedDocs[doc.fileName] = saved.id;
    await storeSample(storageKey, `${doc.fileName} (v${doc.version}) - Retrofit Portal demo`);
  }

  await db.deliverable.deleteMany({ where: { projectId: hero.id } });
  await db.deliverable.createMany({
    data: [
      { projectId: hero.id, title: "EPC Pre-Retrofit Report", description: "Baseline energy performance certificate.", kind: "PDF", status: "AVAILABLE", documentId: savedDocs["EPC Pre-Retrofit Report.pdf"], availableAt: daysAgo(10) },
      { projectId: hero.id, title: "Funding Assessment #V2", description: "ECO4 contribution breakdown.", kind: "SPREADSHEET", status: "AVAILABLE", documentId: savedDocs["Funding Assessment V2.pdf"], availableAt: daysAgo(6) },
      { projectId: hero.id, title: "Technical Survey Report", description: "In progress", kind: "REPORT", status: "IN_PROGRESS", estimatedAt: daysAhead(9) },
    ],
  });

  await db.message.createMany({
    data: [
      { projectId: hero.id, authorId: staff.john!.id, body: "Hi Sarah, EPC received. Reviewing now.", createdAt: daysAgo(0.2) },
      { projectId: hero.id, authorId: sarah.id, body: "Okay, thank you!", createdAt: daysAgo(0.19) },
    ],
  });

  await db.activity.createMany({
    data: [
      { projectId: hero.id, actorId: staff.john!.id, type: "visit.confirmed", message: "Site visit confirmed for Thursday", createdAt: daysAgo(1) },
      { projectId: hero.id, actorId: sarah.id, type: "comment", message: "Comment on Invoice #902", createdAt: daysAgo(0.2) },
      { projectId: hero.id, actorId: staff.mike!.id, type: "document.uploaded", message: "Technical Survey Uploaded", createdAt: daysAgo(0.08) },
    ],
  });

  const tasks: Array<{ title: string; column: string; tags: string[]; visibleToClient?: boolean; assignee?: string; dueInDays?: number }> = [
    { title: "Collect proof of ownership", column: "AWAITING_CLIENT", tags: ["Client", "Docs"], visibleToClient: true, dueInDays: 3 },
    { title: "Book site survey", column: "ASSESSMENT", tags: ["Assessor"], assignee: "mike", dueInDays: -1 },
    { title: "RdSAP energy model", column: "ASSESSMENT", tags: ["Assessor"], assignee: "mike", dueInDays: 5 },
    { title: "Ventilation strategy", column: "DESIGN", tags: ["Designer"], assignee: "jane", dueInDays: 12 },
    { title: "Order created", column: "DONE", tags: ["System", "Done"] },
    { title: "Funding eligibility check", column: "DONE", tags: ["Funding", "Done"], assignee: "john" },
  ];
  const positions: Record<string, number> = {};
  for (const task of tasks) {
    const position = (positions[task.column] = (positions[task.column] ?? -1) + 1);
    await db.task.create({
      data: {
        projectId: hero.id,
        title: task.title,
        column: task.column as never,
        position,
        tags: task.tags,
        visibleToClient: task.visibleToClient ?? false,
        assigneeId: task.assignee ? staff[task.assignee]!.id : null,
        createdById: staff.john!.id,
        dueDate: task.dueInDays !== undefined ? daysAhead(task.dueInDays) : null,
        completedAt: task.column === "DONE" ? daysAgo(20) : null,
      },
    });
  }

  // Overdue tasks on other projects so the admin dashboard has numbers.
  const overdueProjects = await db.project.findMany({ where: { hasIssues: true }, select: { id: true } });
  for (const [index, project] of overdueProjects.entries()) {
    await db.task.create({
      data: { projectId: project.id, title: "Chase outstanding evidence", column: "AWAITING_CLIENT", position: 0, tags: ["Client"], visibleToClient: true, dueDate: daysAgo(index + 1), assigneeId: staff.rob!.id },
    });
  }

  // ─── Billing ──────────────────────────────────────────────────────────────
  for (let month = 0; month < 6; month++) {
    const issued = new Date(now);
    issued.setMonth(issued.getMonth() - month);
    issued.setDate(12);
    await db.invoice.create({
      data: { userId: sarah.id, number: `INV-${issued.getFullYear()}-${String(90 - month).padStart(5, "0")}`, description: "Priority plan (monthly)", amountPence: 2900, status: "PAID", issuedAt: issued },
    });
  }

  // ─── Platform ─────────────────────────────────────────────────────────────
  // Email templates start as the built-in defaults; saving one in Settings creates an override row.
  await db.counter.createMany({
    data: [
      { key: "project-2026", value: 100 },
      { key: "order-2026", value: orderNumber },
      { key: "invoice-2026", value: 100 },
    ],
  });

  const counts = {
    users: await db.user.count(),
    services: await db.service.count(),
    projects: await db.project.count(),
    orders: await db.order.count(),
  };
  console.log("Done.", counts);
  console.log(`\n  Admin:  ${adminEmail} / ${process.env.SEED_ADMIN_PASSWORD ? "(SEED_ADMIN_PASSWORD)" : adminPassword}`);
  console.log("  Client: sarah.jenkins@example.com / Retrofit123!");
  console.log("  Staff:  john.hopkins@retrofitportal.co.uk / Retrofit123!\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
