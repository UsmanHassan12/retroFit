/**
 * Demo data. Run with `npm run db:seed`.
 *
 * Loads the 11 StepSoft services (stages, intake questions, document lists, deliverables,
 * add-ons), the common intake questions, the bundle, bank holidays and the commercial
 * settings from the draft catalogue — all as editable data — plus demo users and projects.
 *
 * ⚠ Wipes every table first so the result is predictable. It refuses to run when
 *   NODE_ENV=production unless SEED_FORCE=1 is set.
 *
 * Accounts (password Retrofit123! unless noted):
 *   admin     SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (default admin@retrofitportal.co.uk / Admin123!)
 *   Basic     sarah.jenkins@example.com            — homeowner, pays by card
 *   Partner   ops@acme-insulation.example          — Premium Partner, weekly invoice, 10% (15% on RC)
 *   Partner   retrofit@northern-homes.example      — Premium Partner, pays in advance from credit
 *   Applicant hello@bright-lofts.example           — partner application waiting for approval
 *   Staff     john.hopkins@retrofitportal.co.uk (coordinator), mike.ross@… (assessor), jane.doe@… (designer)…
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../src/server/auth/password";
import { addDays, billingPeriod, isWorkingDay, latestCutoff, localDate } from "../src/server/rules/calendar";
import { priceLine } from "../src/server/rules/pricing";
import { defaultSettings } from "../src/server/settings-schema";
import { addonsFor, BANK_HOLIDAYS, BUNDLES, COMMON_QUESTIONS, COMPLIANCE_CARDS, SERVICES, type SeedService } from "./data/catalogue";

const db = new PrismaClient();

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * DAY);
const daysAhead = (days: number) => new Date(now + days * DAY);
const settings = defaultSettings();
const VAT = settings.vat.rateBps;

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
  const order = [
    "auditLog", "activity", "revisionRequest", "deliverableVersion", "deliverable", "message", "document", "task", "visit",
    "projectMilestone", "projectMember", "project", "invoiceLine", "creditEntry", "accountHold", "invoice", "orderLineAddon",
    "orderLine", "order", "discountCode", "availability", "bundleItem", "bundle", "partnerServiceDiscount", "intakeQuestion",
    "serviceDocumentRequirement", "serviceDeliverable", "serviceStage", "serviceAddon", "service", "property", "partnerProfile",
    "invite", "passwordResetToken", "emailTemplate", "setting", "bankHoliday", "counter", "user",
  ];
  for (const model of order) await (db as any)[model].deleteMany();
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    throw new Error("Refusing to wipe a production database. Set SEED_FORCE=1 if you really mean it.");
  }
  console.log("Seeding Retrofit Portal…");
  await wipe();

  // ─── Settings & calendar ──────────────────────────────────────────────────
  for (const [key, value] of Object.entries(settings)) await db.setting.create({ data: { key, value: value as never } });
  await db.bankHoliday.createMany({ data: BANK_HOLIDAYS.map(([date, name]) => ({ date: new Date(`${date}T00:00:00Z`), name })) });
  const holidays = new Set<string>(BANK_HOLIDAYS.map(([date]) => date));

  // ─── Users ────────────────────────────────────────────────────────────────
  const demoHash = await hashPassword("Retrofit123!");
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@retrofitportal.co.uk").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const admin = await db.user.create({
    data: { email: adminEmail, passwordHash: await hashPassword(adminPassword), firstName: "John", lastName: "Smith", role: "ADMIN", canViewAllProjects: true, lastLoginAt: new Date(), avatarUrl: "/images/avatars/profile-portrait.webp" },
  });

  const staffSpec = [
    { key: "john", firstName: "John", lastName: "Hopkins", role: "COORDINATOR", avatarUrl: "/images/avatars/john-hopkins.webp", canViewAllProjects: false },
    { key: "mike", firstName: "Mike", lastName: "Ross", role: "ASSESSOR", avatarUrl: null, canViewAllProjects: false },
    { key: "jane", firstName: "Jane", lastName: "Doe", role: "DESIGNER", avatarUrl: "/images/avatars/staff-3.webp", canViewAllProjects: false },
    { key: "rob", firstName: "Rob", lastName: "Clarke", role: "ASSESSOR", avatarUrl: "/images/avatars/staff-2.webp", canViewAllProjects: false },
    { key: "marie", firstName: "Marie", lastName: "Dubois", role: "DESIGNER", avatarUrl: "/images/avatars/staff-1.webp", canViewAllProjects: false },
    { key: "aron", firstName: "Aron", lastName: "Patel", role: "COORDINATOR", avatarUrl: null, canViewAllProjects: true },
  ] as const;
  const staff: Record<string, { id: string }> = {};
  for (const [index, member] of staffSpec.entries()) {
    const { key, ...data } = member;
    staff[key] = await db.user.create({ data: { ...data, email: `${member.firstName}.${member.lastName}@retrofitportal.co.uk`.toLowerCase(), passwordHash: demoHash, lastLoginAt: daysAgo(index * 0.7) } });
  }

  const client = (data: { email: string; firstName: string; lastName: string; avatarUrl?: string; customerType?: string; companyName?: string; phone?: string }) =>
    db.user.create({ data: { ...data, customerType: (data.customerType ?? "HOMEOWNER") as never, passwordHash: demoHash, role: "CLIENT", lastLoginAt: new Date() } });

  const sarah = await client({ email: "sarah.jenkins@example.com", firstName: "Sarah", lastName: "Jenkins", phone: "+44 7700 900123", avatarUrl: "/images/avatars/sarah.webp" });
  const others = await Promise.all(
    [
      ["Priya", "Shah", "customer-1", "LANDLORD"],
      ["Tom", "Whitaker", "customer-2", "HOMEOWNER"],
      ["Aisha", "Rahman", "customer-3", "LANDLORD"],
      ["Daniel", "Okafor", "customer-4", "HOMEOWNER"],
    ].map(([firstName, lastName, avatar, type]) => client({ email: `${firstName}.${lastName}@example.com`.toLowerCase(), firstName: firstName!, lastName: lastName!, avatarUrl: `/images/avatars/${avatar}.webp`, customerType: type })),
  );
  const acme = await client({ email: "ops@acme-insulation.example", firstName: "Leah", lastName: "Morgan", companyName: "Acme Insulation Ltd", customerType: "INSTALLER", phone: "+44 161 555 0101" });
  const northern = await client({ email: "retrofit@northern-homes.example", firstName: "Owen", lastName: "Price", companyName: "Northern Homes Housing Association", customerType: "HOUSING_ASSOCIATION" });
  const bright = await client({ email: "hello@bright-lofts.example", firstName: "Nadia", lastName: "Ellis", companyName: "Bright Lofts Ltd", customerType: "INSTALLER" });

  // ─── Catalogue ────────────────────────────────────────────────────────────
  const services: Record<string, any> = {};
  for (const [position, spec] of SERVICES.entries()) {
    services[spec.code] = await createService(spec, position);
  }
  for (const [position, question] of COMMON_QUESTIONS.entries()) {
    await db.intakeQuestion.create({
      data: { serviceId: null, key: question.key, label: question.label, type: question.type, required: question.required ?? false, options: (question.options ?? undefined) as never, condition: (question.condition ?? undefined) as never, scope: question.scope ?? "ORDER", step: question.step ?? 0, position },
    });
  }
  for (const bundle of BUNDLES) {
    await db.bundle.create({
      data: {
        code: bundle.code,
        slug: bundle.slug,
        name: bundle.name,
        description: bundle.description,
        pricePence: bundle.pricePence,
        items: { create: bundle.services.map((code, position) => ({ serviceId: services[code].id, position })) },
      },
    });
  }
  await db.discountCode.createMany({ data: [{ code: "RETRO2026", percentOff: 10 }, { code: "WELCOME5", percentOff: 5, maxRedemptions: 500 }] });

  // ─── Partners ─────────────────────────────────────────────────────────────
  const acmeProfile = await db.partnerProfile.create({
    data: {
      userId: acme.id, companyName: "Acme Insulation Ltd", companyNumber: "09876543", vatNumber: "GB123456789", trustmarkLicence: "TM-48213",
      status: "ACTIVE", discountBps: 1_000, paymentMode: "WEEKLY", creditLimitPence: 500_000,
      agreementVersion: settings.partner.agreementVersion, agreementSignedAt: daysAgo(60), agreementSignedName: "Leah Morgan", agreementSignedIp: "203.0.113.10",
      appliedAt: daysAgo(65), approvedAt: daysAgo(62), approvedById: admin.id, activatedAt: daysAgo(60),
      subscriptionStatus: "active", subscriptionRenewsAt: daysAhead(9),
    },
  });
  await db.partnerServiceDiscount.create({ data: { partnerId: acmeProfile.id, serviceId: services.RC.id, discountBps: 1_500 } });
  await db.partnerProfile.create({
    data: {
      userId: northern.id, companyName: "Northern Homes Housing Association", status: "ACTIVE", discountBps: 1_200, paymentMode: "ADVANCE",
      agreementVersion: settings.partner.agreementVersion, agreementSignedAt: daysAgo(30), agreementSignedName: "Owen Price", agreementSignedIp: "198.51.100.7",
      appliedAt: daysAgo(35), approvedAt: daysAgo(32), approvedById: admin.id, activatedAt: daysAgo(30), subscriptionStatus: "active", subscriptionRenewsAt: daysAhead(29.5),
    },
  });
  await db.partnerProfile.create({
    data: { userId: bright.id, companyName: "Bright Lofts Ltd", trustmarkLicence: "TM-55102", status: "APPLIED", discountBps: settings.partner.defaultDiscountBps, applicationNote: "About 20 loft and cavity jobs a month under GBIS.", appliedAt: daysAgo(1) },
  });

  // ─── Visit availability (next 30 days, NW and M areas) ────────────────────
  const today = localDate(new Date());
  for (let offset = 1; offset <= 30; offset++) {
    const day = addDays(today, offset);
    if (!isWorkingDay(day, holidays)) continue;
    for (const [assessor, region] of [["mike", "NW"], ["rob", "M"]] as const) {
      for (const window of ["AM", "PM"] as const) {
        await db.availability.create({ data: { assessorId: staff[assessor]!.id, regionPrefix: region, date: new Date(`${day}T00:00:00Z`), window, capacity: 2 } });
      }
    }
  }

  // ─── Bookings & projects ──────────────────────────────────────────────────
  let orderNumber = 100;
  let invoiceNumber = 0;
  const nextInvoice = () => `INV-2026-${String(++invoiceNumber).padStart(4, "0")}`;

  type Booking = {
    reference: string;
    user: { id: string };
    code: string;
    tier: "BASIC" | "PARTNER";
    discountBps?: number;
    method: "CARD" | "CREDIT" | "WEEKLY_INVOICE";
    quantity?: number;
    address?: [string, string, string];
    title?: string;
    image?: string;
    /** Index of the current stage (0-based). Use stages.length for completed. */
    stage: number;
    status: string;
    health?: "ON_TRACK" | "AT_RISK" | "DELAYED";
    priority?: "LOW" | "MEDIUM" | "HIGH" | "QA_REJECT";
    issue?: string;
    critical?: boolean;
    bookedDaysAgo: number;
    dueInDays?: number | null;
    team: string[];
    fundingPence?: number;
    answers?: Record<string, unknown>;
    lineAnswers?: Record<string, unknown>;
  };

  async function book(spec: Booking) {
    const service = services[spec.code];
    const seedService = SERVICES.find((item) => item.code === spec.code)!;
    const property = spec.address
      ? await db.property.create({ data: { ownerId: spec.user.id, line1: spec.address[0], city: spec.address[1], postcode: spec.address[2], propertyType: "house", builtForm: "semi-detached", tenure: "owner-occupied", verified: true } })
      : null;
    const quantity = spec.quantity ?? 1;
    const price = priceLine({ unitPricePence: service.listPricePence, quantity, discountBps: spec.discountBps ?? 0, addons: [], vatBps: VAT });
    const bookedAt = daysAgo(spec.bookedDaysAgo);
    const paid = spec.method !== "WEEKLY_INVOICE";
    const fastTrack = spec.tier === "PARTNER" && service.fastTrackDays !== null;
    const order = await db.order.create({
      data: {
        reference: `ORD-2026-${String(++orderNumber).padStart(6, "0")}`,
        userId: spec.user.id,
        status: "CONFIRMED",
        customerTier: spec.tier,
        paymentMethod: spec.method,
        answers: (spec.answers ?? { scheme: "ECO4", measures: ["CWI", "LI"], installerCompany: "Acme Insulation Ltd", trustmarkLicence: "TM-48213", pas2030Certified: true }) as never,
        termsVersion: settings.booking.termsVersion,
        termsAcceptedAt: bookedAt,
        gdprConsent: true,
        shareDataConsent: true,
        listPence: price.listPence,
        discountPence: price.discountPence,
        discountSource: price.discountPence ? "PARTNER" : "NONE",
        netPence: price.netPence,
        vatPence: price.vatPence,
        totalPence: price.totalPence,
        creditAppliedPence: spec.method === "CREDIT" ? price.totalPence : 0,
        confirmedAt: bookedAt,
        paidAt: paid ? bookedAt : null,
        createdAt: bookedAt,
        lines: {
          create: [
            {
              serviceId: service.id,
              propertyId: property?.id ?? null,
              serviceCode: service.code,
              serviceTitle: service.title,
              priceUnit: service.priceUnit,
              unitPricePence: service.listPricePence,
              quantity,
              listPence: price.listPence,
              discountBps: price.discountBps,
              discountPence: price.discountPence,
              netPence: price.netPence,
              vatPence: price.vatPence,
              totalPence: price.totalPence,
              fastTrack,
              turnaroundDays: fastTrack ? service.fastTrackDays : service.standardDays,
              answers: (spec.lineAnswers ?? defaultAnswers(seedService)) as never,
              createdAt: bookedAt,
            },
          ],
        },
      },
      include: { lines: true },
    });
    const line = order.lines[0]!;
    if (paid) {
      await db.invoice.create({
        data: {
          number: nextInvoice(), userId: spec.user.id, kind: "ORDER", status: "PAID", description: `Booking ${order.reference}`,
          subtotalPence: price.netPence, vatPence: price.vatPence, totalPence: price.totalPence, vatRateBps: VAT, seller: settings.seller as never,
          issuedAt: bookedAt, paidAt: bookedAt, paidVia: spec.method,
          lines: { create: [{ description: service.title, orderId: order.id, listPence: price.listPence, discountPence: price.discountPence, netPence: price.netPence, vatPence: price.vatPence, totalPence: price.totalPence }] },
        },
      });
    }

    const stages = seedService.stages;
    const completed = spec.status === "COMPLETED";
    const project = await db.project.create({
      data: {
        reference: spec.reference,
        orderId: order.id,
        orderLineId: line.id,
        clientId: spec.user.id,
        serviceId: service.id,
        propertyId: property?.id ?? null,
        coordinatorId: staff.john!.id,
        title: spec.title ?? (property ? `${service.title} — ${property.line1}, ${property.postcode}` : service.title),
        coverImageUrl: spec.image ?? null,
        status: spec.status as never,
        health: spec.health ?? "ON_TRACK",
        priority: spec.priority ?? (spec.tier === "PARTNER" ? "HIGH" : "MEDIUM"),
        partnerPriority: spec.tier === "PARTNER",
        progress: completed ? 100 : Math.round((spec.stage / Math.max(1, stages.length - 1)) * 95),
        fastTrack,
        turnaroundDays: fastTrack ? service.fastTrackDays : service.standardDays,
        revisionRoundsIncluded: service.revisionRounds,
        scheme: "ECO4",
        fundingSecuredPence: spec.fundingPence ?? 0,
        hasIssues: Boolean(spec.issue),
        criticalIssue: Boolean(spec.critical),
        issueSummary: spec.issue ?? null,
        intakeCompleteAt: spec.status === "AWAITING_INFO" ? null : bookedAt,
        clockStartAt: spec.status === "AWAITING_INFO" ? null : bookedAt,
        startedAt: bookedAt,
        workStartedAt: ["IN_PROGRESS", "IN_QA", "DELIVERED", "COMPLETED"].includes(spec.status) ? bookedAt : null,
        deliveredAt: ["DELIVERED", "COMPLETED"].includes(spec.status) ? daysAgo(Math.max(0, spec.bookedDaysAgo - 10)) : null,
        completedAt: completed ? daysAgo(Math.max(0, spec.bookedDaysAgo - 14)) : null,
        createdAt: bookedAt,
        dueDate: spec.dueInDays === null ? null : daysAhead(spec.dueInDays ?? 5),
        milestones: {
          create: service.stages.map((stage: any, index: number) => {
            const status = completed || index < spec.stage ? ("DONE" as const) : index === spec.stage ? ("CURRENT" as const) : ("UPCOMING" as const);
            return {
              stageId: stage.id, position: index, title: stage.name, description: stage.description, clientVisible: stage.clientVisible, defaultRole: stage.defaultRole, projectStatus: stage.projectStatus,
              status, startedAt: index <= spec.stage ? daysAgo(Math.max(0, spec.bookedDaysAgo - index)) : null, completedAt: status === "DONE" ? daysAgo(Math.max(0, spec.bookedDaysAgo - index)) : null,
            };
          }),
        },
        members: { create: [...new Set(["john", ...spec.team])].map((key) => ({ userId: staff[key]!.id })) },
        deliverables: {
          create: service.deliverables.map((item: any) => ({ serviceDeliverableId: item.id, title: item.name, description: item.description, kind: item.kind, versioned: item.versioned, status: completed ? ("AVAILABLE" as const) : ("PENDING" as const), availableAt: completed ? daysAgo(5) : null })),
        },
        activities: { create: [{ actorId: spec.user.id, type: "order.confirmed", message: `Order ${order.reference} confirmed`, createdAt: bookedAt }] },
        tasks: { create: [{ title: "Order confirmed", column: "DONE", position: 0, tags: ["System"], completedAt: bookedAt }] },
      },
    });
    return { order, line, project, property, price };
  }

  const ASSESSMENT_ANSWERS = { customerIsOwner: true, mainHeating: "Gas combi boiler", occupants: 3, vulnerableOccupants: false };

  // The hero project from the designs: Sarah's Retrofit Assessment with a visit booked.
  const hero = await book({
    reference: "RET-2026-0042", user: sarah, code: "RA", tier: "BASIC", method: "CARD", address: ["124 Oakwood Crescent", "London", "NW10 6RF"],
    title: "Retrofit Assessment — 124 Oakwood Crescent", image: "/images/services/solar-roof.webp", stage: 2, status: "SCHEDULED", bookedDaysAgo: 6, dueInDays: 8, team: ["mike"],
    answers: { scheme: "GBIS", funderName: "British Gas" }, lineAnswers: ASSESSMENT_ANSWERS,
  });
  const visitSlot = await db.availability.findFirst({ where: { assessorId: staff.mike!.id, date: { gte: daysAhead(2) } }, orderBy: { date: "asc" } });
  if (visitSlot) {
    await db.availability.update({ where: { id: visitSlot.id }, data: { bookedCount: 1 } });
    await db.visit.create({ data: { projectId: hero.project.id, availabilityId: visitSlot.id, assessorId: staff.mike!.id, date: visitSlot.date, window: visitSlot.window, kind: "INITIAL" } });
  }
  await db.project.update({ where: { id: hero.project.id }, data: { phaseNotice: "Please make sure the assessor can access the loft and the meter cupboard." } });

  await book({ reference: "RET-2026-0057", user: sarah, code: "RD", tier: "BASIC", method: "CARD", address: ["42 Maple Avenue", "Manchester", "M14 5TQ"], image: "/images/dashboard/project-terrace.webp", stage: 2, status: "IN_PROGRESS", bookedDaysAgo: 4, dueInDays: 4, team: ["jane"], answers: { scheme: "PRIVATE", measures: ["EWI", "VENTILATION"] }, lineAnswers: { measuresToDesign: ["EWI", "VENTILATION"] } });
  await book({ reference: "RET-2026-0063", user: sarah, code: "TS", tier: "BASIC", method: "CARD", address: ["8 Linden Grove", "Bristol", "BS6 7RD"], image: "/images/dashboard/project-modern.webp", stage: 1, status: "AWAITING_INFO", bookedDaysAgo: 2, dueInDays: null, team: [], answers: { scheme: "PRIVATE", measures: ["IWI"] }, lineAnswers: { surveyReason: "NON_STANDARD", listedOrConservation: false } });
  await book({ reference: "RET-2026-0021", user: sarah, code: "RA", tier: "BASIC", method: "CARD", address: ["5 Church Lane", "York", "YO1 7HH"], stage: 7, status: "COMPLETED", bookedDaysAgo: 140, dueInDays: -130, team: ["mike"], fundingPence: 420_000, lineAnswers: ASSESSMENT_ANSWERS });
  await book({ reference: "RET-2026-0031", user: sarah, code: "UV", tier: "BASIC", method: "CARD", quantity: 3, address: ["3 Mill Close", "Oxford", "OX2 6PL"], stage: 5, status: "COMPLETED", bookedDaysAgo: 100, dueInDays: -95, team: ["marie"], answers: { scheme: "PRIVATE", measures: ["IWI"] }, lineAnswers: { elementTypes: ["WALL"], existingConstruction: "Solid brick 225mm", proposedInsulation: "PIR 50mm", purpose: "BUILDING_CONTROL" } });
  // Sarah's primary (profile) property.
  await db.property.create({ data: { ownerId: sarah.id, line1: "12–14 Kingsway Court", city: "Hove", postcode: "BN3 2LP", propertyType: "flat", tenure: "owner-occupied", epcNumber: "8821-0293-1402-4211-1025", verified: true, isPrimary: true } });

  // Other Basic clients (admin queue).
  await book({ reference: "RET-2026-0070", user: others[0]!, code: "RA", tier: "BASIC", method: "CARD", address: ["23 Oak Avenue", "Manchester", "M20 2RN"], stage: 3, status: "IN_PROGRESS", health: "AT_RISK", priority: "HIGH", issue: "EPC data overdue", critical: true, bookedDaysAgo: 9, dueInDays: -1, team: ["rob"], lineAnswers: ASSESSMENT_ANSWERS });
  await book({ reference: "RET-2026-0072", user: others[2]!, code: "RD", tier: "BASIC", method: "CARD", address: ["51 Park Lane", "Stockport", "SK1 3BT"], stage: 4, status: "IN_QA", health: "AT_RISK", priority: "QA_REJECT", issue: "Design failed QA", bookedDaysAgo: 10, dueInDays: 2, team: ["marie"], lineAnswers: { measuresToDesign: ["ASHP"] } });
  await book({ reference: "RET-2026-0076", user: others[1]!, code: "TB", tier: "BASIC", method: "CARD", quantity: 4, address: ["14 Willow Bank", "Leeds", "LS6 2QA"], stage: 5, status: "DELIVERED", bookedDaysAgo: 12, dueInDays: -3, team: ["marie"], lineAnswers: { junctionTypes: ["WALL_FLOOR", "WINDOW_REVEAL"], measure: "EWI", proposedProduct: "EPS 90mm" } });
  await book({ reference: "RET-2026-0077", user: others[3]!, code: "ES", tier: "BASIC", method: "CARD", stage: 2, status: "IN_PROGRESS", health: "DELAYED", priority: "HIGH", issue: "Funding evidence pending", bookedDaysAgo: 5, dueInDays: 1, team: ["aron"], lineAnswers: { energySupplier: "Octopus Energy", submissionType: "NEW", completionDate: "2026-10-30" } });

  // ─── Acme: Premium Partner on weekly invoices ─────────────────────────────
  const schedule = { timeZone: "Europe/London", cutoffWeekday: 5, cutoffTime: "17:00", dueDaysAfterCutoff: 7, dueTime: "18:00" };
  const lastCutoff = latestCutoff(new Date(), schedule);
  const lastPeriod = billingPeriod(lastCutoff, schedule);
  const lastWeekDaysAgo = Math.max(1, Math.ceil((now - lastPeriod.start.getTime()) / DAY) - 1);
  const billedA = await book({ reference: "RET-2026-0080", user: acme, code: "RA", tier: "PARTNER", discountBps: 1_000, method: "WEEKLY_INVOICE", address: ["17 Harbour Street", "Leeds", "LS1 4AB"], stage: 4, status: "IN_PROGRESS", bookedDaysAgo: lastWeekDaysAgo, dueInDays: 1, team: ["rob"], lineAnswers: ASSESSMENT_ANSWERS });
  const billedB = await book({ reference: "RET-2026-0081", user: acme, code: "RC", tier: "PARTNER", discountBps: 1_500, method: "WEEKLY_INVOICE", address: ["17 Harbour Street", "Leeds", "LS1 4AB"], stage: 2, status: "IN_PROGRESS", bookedDaysAgo: lastWeekDaysAgo, dueInDays: null, team: ["aron"], lineAnswers: { plannedInstallDates: "Early December", stepsoftAssessment: true, stepsoftDesign: false } });
  const weekly = await db.invoice.create({
    data: {
      number: nextInvoice(), userId: acme.id, kind: "WEEKLY", status: "ISSUED", description: "Weekly invoice — bookings to last Friday",
      periodStart: lastPeriod.start, periodEnd: lastPeriod.end, dueAt: lastPeriod.due, issuedAt: lastPeriod.end, vatRateBps: VAT, seller: settings.seller as never,
      subtotalPence: billedA.price.netPence + billedB.price.netPence, vatPence: billedA.price.vatPence + billedB.price.vatPence, totalPence: billedA.price.totalPence + billedB.price.totalPence,
      lines: {
        create: [billedA, billedB].map((item) => ({
          description: `${item.line.serviceTitle} — ${item.property!.line1} (${item.project.reference}) · ${item.order.reference}`, orderId: item.order.id, orderLineId: item.line.id,
          listPence: item.price.listPence, discountPence: item.price.discountPence, netPence: item.price.netPence, vatPence: item.price.vatPence, totalPence: item.price.totalPence,
        })),
      },
    },
  });
  // This week's bookings: not invoiced yet (they'll go on Friday's invoice).
  await book({ reference: "RET-2026-0082", user: acme, code: "UV", tier: "PARTNER", discountBps: 1_000, method: "WEEKLY_INVOICE", quantity: 4, address: ["2 Coronation Street", "Salford", "M5 3EF"], stage: 2, status: "IN_PROGRESS", bookedDaysAgo: 0.2, dueInDays: 0, team: ["marie"], lineAnswers: { elementTypes: ["WALL", "ROOF"], existingConstruction: "Cavity 50mm", proposedInsulation: "Bead 50mm", purpose: "SAP" } });
  await book({ reference: "RET-2026-0083", user: acme, code: "RA", tier: "PARTNER", discountBps: 1_000, method: "WEEKLY_INVOICE", address: ["9 Station Road", "Bolton", "BL1 4QP"], stage: 1, status: "AWAITING_INFO", bookedDaysAgo: 0.1, dueInDays: null, team: [], lineAnswers: { mainHeating: "Gas boiler", occupants: 2 } });

  // ─── Northern Homes: Premium Partner paying in advance ────────────────────
  const topupReceipt = await db.invoice.create({
    data: { number: nextInvoice(), userId: northern.id, kind: "CREDIT_TOPUP", status: "PAID", description: "Account credit top-up (bank transfer)", subtotalPence: 150_000, vatPence: 0, totalPence: 150_000, vatRateBps: VAT, seller: settings.seller as never, issuedAt: daysAgo(20), paidAt: daysAgo(20), paidVia: "BANK_TRANSFER", lines: { create: [{ description: "Prepaid account credit", netPence: 150_000, vatPence: 0, totalPence: 150_000 }] } },
  });
  await db.creditEntry.create({ data: { userId: northern.id, type: "TOPUP", amountPence: 150_000, balanceAfterPence: 150_000, invoiceId: topupReceipt.id, note: "Bank transfer", createdById: admin.id, createdAt: daysAgo(20) } });
  const nh = await book({ reference: "RET-2026-0090", user: northern, code: "TS", tier: "PARTNER", discountBps: 1_200, method: "CREDIT", address: ["4 Wimpey Close", "Wigan", "WN1 2DD"], stage: 3, status: "IN_PROGRESS", bookedDaysAgo: 15, dueInDays: 1, team: ["rob"], answers: { scheme: "SHDF", measures: ["EWI"], installerCompany: "Acme Insulation Ltd", trustmarkLicence: "TM-48213", pas2030Certified: true }, lineAnswers: { surveyReason: "NON_STANDARD", constructionType: "Wimpey no-fines", listedOrConservation: false } });
  const nhReceipt = await db.invoice.findFirst({ where: { userId: northern.id, kind: "ORDER" } });
  await db.creditEntry.create({ data: { userId: northern.id, type: "DEDUCTION", amountPence: -nh.price.totalPence, balanceAfterPence: 150_000 - nh.price.totalPence, orderId: nh.order.id, invoiceId: nhReceipt?.id ?? null, note: `Booking ${nh.order.reference}`, createdAt: daysAgo(15) } });

  // ─── Hero project detail (docs, chat, board, deliverables) ────────────────
  const docs = [
    { fileName: "Current EPC.pdf", requirementKey: "existingEpc", by: sarah.id, at: daysAgo(5) },
    { fileName: "Floor Plan.pdf", by: sarah.id, at: daysAgo(3) },
    { fileName: "Site access notes.pdf", by: staff.john!.id, at: daysAgo(1) },
  ];
  for (const [index, doc] of docs.entries()) {
    const storageKey = `projects/${hero.project.id}/seed-${index}/${doc.fileName}`;
    await db.document.create({ data: { projectId: hero.project.id, uploadedById: doc.by, fileName: doc.fileName, mimeType: "application/pdf", sizeBytes: 1200, storageKey, status: "ACTIVE", requirementKey: doc.requirementKey ?? null, createdAt: doc.at } });
    await storeSample(storageKey, `${doc.fileName} - Retrofit Portal demo`);
  }
  await db.message.createMany({
    data: [
      { projectId: hero.project.id, authorId: staff.john!.id, body: "Hi Sarah, your EPC is in and Mike is booked for the visit. Anything we should know about access?", createdAt: daysAgo(0.2) },
      { projectId: hero.project.id, authorId: sarah.id, body: "The side gate is unlocked. Thank you!", createdAt: daysAgo(0.19) },
    ],
  });
  await db.activity.createMany({
    data: [
      { projectId: hero.project.id, actorId: staff.john!.id, type: "visit.booked", message: "Site visit booked", createdAt: daysAgo(4) },
      { projectId: hero.project.id, actorId: sarah.id, type: "document.uploaded", message: "Current EPC.pdf uploaded", createdAt: daysAgo(5) },
    ],
  });
  const tasks: Array<{ title: string; column: string; tags: string[]; visibleToClient?: boolean; assignee?: string; dueInDays?: number }> = [
    { title: "Site visit (1–3 hours)", column: "ASSESSMENT", tags: ["Assessor"], assignee: "mike", dueInDays: 2 },
    { title: "Confirm loft access with client", column: "AWAITING_CLIENT", tags: ["Client"], visibleToClient: true, dueInDays: 1 },
    { title: "Visit booked", column: "DONE", tags: ["Coordinator"], assignee: "john" },
  ];
  const positions: Record<string, number> = { DONE: 1 };
  for (const task of tasks) {
    const position = (positions[task.column] = (positions[task.column] ?? -1) + 1);
    await db.task.create({
      data: { projectId: hero.project.id, title: task.title, column: task.column as never, position, tags: task.tags, visibleToClient: task.visibleToClient ?? false, assigneeId: task.assignee ? staff[task.assignee]!.id : null, createdById: staff.john!.id, dueDate: task.dueInDays !== undefined ? daysAhead(task.dueInDays) : null, completedAt: task.column === "DONE" ? daysAgo(4) : null },
    });
  }
  const overdue = await db.project.findMany({ where: { hasIssues: true }, select: { id: true } });
  for (const [index, project] of overdue.entries()) {
    await db.task.create({ data: { projectId: project.id, title: "Chase outstanding evidence", column: "AWAITING_CLIENT", position: 0, tags: ["Client"], visibleToClient: true, dueDate: daysAgo(index + 1), assigneeId: staff.rob!.id } });
  }

  // ─── Counters ─────────────────────────────────────────────────────────────
  await db.counter.createMany({
    data: [
      { key: "project-2026", value: 100 },
      { key: "order-2026", value: orderNumber },
      { key: "invoice-2026", value: invoiceNumber },
    ],
  });

  const counts = { users: await db.user.count(), services: await db.service.count(), projects: await db.project.count(), orders: await db.order.count(), invoices: await db.invoice.count(), slots: await db.availability.count() };
  console.log("Done.", counts, `weekly invoice ${weekly.number} due ${weekly.dueAt?.toISOString()}`);
  console.log(`\n  Admin:    ${adminEmail} / ${process.env.SEED_ADMIN_PASSWORD ? "(SEED_ADMIN_PASSWORD)" : adminPassword}`);
  console.log("  Basic:    sarah.jenkins@example.com / Retrofit123!");
  console.log("  Partner:  ops@acme-insulation.example / Retrofit123!   (weekly invoice)");
  console.log("  Partner:  retrofit@northern-homes.example / Retrofit123!   (pays from credit)");
  console.log("  Staff:    john.hopkins@retrofitportal.co.uk / Retrofit123!\n");
}

/** Plausible answers for a service's required questions (so seeded projects aren't AWAITING_INFO). */
function defaultAnswers(service: SeedService) {
  const answers: Record<string, unknown> = {};
  for (const question of service.questions) {
    if (!question.required || question.condition) continue;
    answers[question.key] =
      question.type === "NUMBER" ? 1 : question.type === "BOOLEAN" ? false : question.type === "DATE" ? "2026-12-01" : question.type === "SELECT" ? question.options?.[0]?.value : question.type === "MULTISELECT" ? [question.options?.[0]?.value] : "Provided at booking";
  }
  return answers;
}

async function createService(spec: SeedService, position: number) {
  return db.service.create({
    data: {
      code: spec.code,
      slug: spec.slug,
      title: spec.title,
      headline: spec.title,
      summary: spec.summary,
      intro: spec.summary,
      category: spec.category,
      badge: spec.category === "FUNDING" ? "Funding" : "PAS 2035",
      schemes: spec.schemes,
      priceUnit: spec.priceUnit,
      listPricePence: spec.listPricePence,
      siteVisit: spec.siteVisit,
      standardDays: spec.standardDays,
      fastTrackDays: spec.fastTrackDays,
      standardLabel: spec.standardLabel ?? null,
      fastTrackLabel: spec.fastTrackLabel ?? null,
      requiresProperty: spec.requiresProperty ?? true,
      imageUrl: spec.image,
      gallery: spec.gallery,
      overview: { paragraphs: [spec.summary, "Prices shown exclude VAT. Premium Partners get their partner discount and fast-track turnaround automatically."], keyAreas: spec.keyAreas },
      included: spec.included,
      compliance: COMPLIANCE_CARDS,
      deliverablesInfo: spec.deliverables.slice(0, 3).map((item, index) => ({ title: item.name, description: item.description, icon: ["report", "certificate", "package"][index] })),
      position,
      stages: {
        create: spec.stages.map((stage, index) => ({
          position: index, name: stage.name, description: stage.description ?? "", clientVisible: stage.clientVisible ?? true, defaultRole: stage.role, slaDays: stage.sla, boardColumn: stage.column, projectStatus: stage.status,
        })),
      },
      questions: {
        create: spec.questions.map((question, index) => ({
          key: question.key, label: question.label, help: question.help ?? null, type: question.type, options: (question.options ?? undefined) as never, required: question.required ?? false, condition: (question.condition ?? undefined) as never, scope: "LINE", position: index,
        })),
      },
      documentRequirements: {
        create: spec.documents.map((doc, index) => ({
          key: doc.key, label: doc.label, required: doc.required ?? true, condition: (doc.condition ?? undefined) as never, timing: doc.timing ?? "BEFORE_START", acceptedTypes: doc.types ?? ["PDF", "JPG", "PNG", "DOCX", "XLSX"], position: index,
        })),
      },
      deliverables: { create: spec.deliverables.map((item, index) => ({ name: item.name, description: item.description, kind: item.kind ?? "PDF", versioned: item.versioned ?? true, position: index })) },
      addons: { create: addonsFor(spec).map((addon, index) => ({ ...addon, freeAllowance: addon.freeAllowance ?? 0, fastTrack: addon.fastTrack ?? false, position: index })) },
    },
    include: { stages: { orderBy: { position: "asc" } }, deliverables: { orderBy: { position: "asc" } } },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
