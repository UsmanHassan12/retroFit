import "server-only";

import { z } from "zod";

import { findAccessibleProject, isStaff } from "../auth/permissions";
import type { AuthUser } from "../auth/session";
import { db } from "../db";
import { AppError, badRequest, conflict, notFound } from "../errors";
import { VISIT_KINDS, VISIT_WINDOWS } from "../domain";
import { addDays, isWorkingDay, localDate } from "../rules/calendar";
import { audit } from "./audit";
import { issueInvoice } from "./invoices";
import { getBankHolidays, getSettings } from "./settings";
import { addActivity, refreshProject, releaseSlot, reserveSlot, transitionProject } from "./workflow";

/**
 * Visit scheduling (intake step 8). Admin publishes capacity per assessor, postcode area and
 * half-day window (AM 8–12, PM 12–6); customers pick a date and window; the slot is taken
 * when the order is confirmed (or straight away when booking from a project).
 */

/** "NW10 6RF" → "NW", "M14 5TQ" → "M". */
export function postcodeArea(postcode: string) {
  const match = /^([A-Z]{1,2})\d/.exec(postcode.trim().toUpperCase());
  if (!match) throw badRequest("Enter a valid UK postcode.");
  return match[1]!;
}

const toDay = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

export const slotQuerySchema = z.object({
  postcode: z.string().trim().min(2),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** GET /api/availability?postcode=NW10 6RF — free AM/PM windows from tomorrow. */
export async function listSlots(input: Record<string, string>) {
  const query = slotQuerySchema.parse(input);
  const [settings, holidays] = await Promise.all([getSettings(), getBankHolidays()]);
  const today = localDate(new Date(), settings.booking.timeZone);
  const from = query.from && query.from > today ? query.from : addDays(today, 1);
  const horizon = addDays(today, settings.booking.bookingHorizonDays);
  const to = query.to && query.to < horizon ? query.to : horizon;

  const rows = await db.availability.findMany({
    where: { regionPrefix: postcodeArea(query.postcode), date: { gte: toDay(from), lte: toDay(to) } },
    orderBy: [{ date: "asc" }, { window: "asc" }],
  });
  // One entry per date + window: the slot with the most room.
  const best = new Map<string, any>();
  for (const row of rows) {
    if (row.bookedCount >= row.capacity) continue;
    const ymd = row.date.toISOString().slice(0, 10);
    if (!isWorkingDay(ymd, holidays)) continue;
    const key = `${ymd}|${row.window}`;
    const current = best.get(key);
    if (!current || row.capacity - row.bookedCount > current.capacity - current.bookedCount) best.set(key, row);
  }
  return [...best.values()].map((row) => ({
    id: row.id as string,
    date: (row.date as Date).toISOString().slice(0, 10),
    window: row.window as "AM" | "PM",
    label: settings.booking.windows[row.window as "AM" | "PM"],
  }));
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export const availabilityCreateSchema = z.object({
  assessorId: z.string().min(1),
  /** Postcode area this assessor covers on those days (M, NW, BS…). */
  region: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}$/, "Use a postcode area like M, NW or BS."),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** 1 = Monday … 5 = Friday. */
  weekdays: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5]),
  windows: z.array(z.enum(VISIT_WINDOWS)).min(1).default(["AM", "PM"]),
  capacity: z.number().int().min(1).max(20).default(1),
});

/** Publish capacity for a date range. Existing slots for the same assessor/date/window are updated. */
export async function createAvailability(actorId: string, input: z.input<typeof availabilityCreateSchema>) {
  const data = availabilityCreateSchema.parse(input);
  if (data.to < data.from) throw badRequest("The end date is before the start date.");
  const assessor = await db.user.findFirst({ where: { id: data.assessorId, role: { in: ["ASSESSOR", "COORDINATOR", "ADMIN"] }, status: "ACTIVE" } });
  if (!assessor) throw notFound("Assessor");
  const holidays = await getBankHolidays();

  let count = 0;
  for (let day = data.from; day <= data.to; day = addDays(day, 1)) {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    if (!data.weekdays.includes(weekday) || holidays.has(day)) continue;
    for (const window of data.windows) {
      // One row per assessor, date and window (an assessor is in one area per half-day).
      await db.availability.upsert({
        where: { assessorId_date_window: { assessorId: data.assessorId, date: toDay(day), window } },
        create: { assessorId: data.assessorId, regionPrefix: data.region, date: toDay(day), window, capacity: data.capacity },
        update: { regionPrefix: data.region, capacity: data.capacity },
      });
      count++;
    }
  }
  await audit(actorId, "availability.create", "User", data.assessorId, { from: data.from, to: data.to, region: data.region });
  return { slots: count };
}

export const availabilityFiltersSchema = z.object({
  assessorId: z.string().optional(),
  region: z.string().trim().toUpperCase().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function listAvailability(input: Record<string, string>) {
  const filters = availabilityFiltersSchema.parse(input);
  const rows = await db.availability.findMany({
    where: {
      ...(filters.assessorId ? { assessorId: filters.assessorId } : {}),
      ...(filters.region ? { regionPrefix: filters.region } : {}),
      ...(filters.from || filters.to ? { date: { ...(filters.from ? { gte: toDay(filters.from) } : {}), ...(filters.to ? { lte: toDay(filters.to) } : {}) } } : {}),
    },
    include: { assessor: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: [{ date: "asc" }, { window: "asc" }],
    take: 500,
  });
  return rows.map((row: any) => ({
    id: row.id as string,
    assessor: { id: row.assessor.id as string, name: `${row.assessor.firstName} ${row.assessor.lastName}`.trim() },
    region: row.regionPrefix as string,
    date: (row.date as Date).toISOString().slice(0, 10),
    window: row.window as string,
    capacity: row.capacity as number,
    booked: row.bookedCount as number,
  }));
}

export const availabilityPatchSchema = z.object({ capacity: z.number().int().min(0).max(20).optional(), regionPrefix: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}$/).optional() });

export async function updateAvailability(actorId: string, id: string, input: z.input<typeof availabilityPatchSchema>) {
  const data = availabilityPatchSchema.parse(input);
  const row = await db.availability.findUnique({ where: { id } });
  if (!row) throw notFound("Slot");
  if (data.capacity !== undefined && data.capacity < row.bookedCount) throw conflict(`${row.bookedCount} visit(s) are already booked in this slot.`);
  await db.availability.update({ where: { id }, data });
  await audit(actorId, "availability.update", "Availability", id, data);
}

export async function deleteAvailability(actorId: string, id: string) {
  const row = await db.availability.findUnique({ where: { id } });
  if (!row) throw notFound("Slot");
  if (row.bookedCount > 0) throw conflict("This slot has bookings. Move the visits first or set capacity to the booked number.");
  await db.availability.delete({ where: { id } });
  await audit(actorId, "availability.delete", "Availability", id);
}

// ─── Visits on a project ────────────────────────────────────────────────────

export const bookVisitSchema = z.object({ availabilityId: z.string().min(1), kind: z.enum(VISIT_KINDS).default("INITIAL") });

/** Client or staff books (or re-books) a visit for a project. */
export async function bookVisit(user: AuthUser, reference: string, input: z.input<typeof bookVisitSchema>) {
  const data = bookVisitSchema.parse(input);
  const project = await findAccessibleProject(user, reference);
  const full = await db.project.findUnique({ where: { id: project.id }, include: { service: true, property: true, visits: { where: { status: "BOOKED" } } } });
  if (!full) throw notFound("Project");
  if (full.service.siteVisit === "NONE") throw badRequest("This service doesn't include a site visit.");
  if (["COMPLETED", "CANCELLED", "ON_HOLD"].includes(full.status)) throw conflict("Visits can't be booked on this project right now.");
  if (!isStaff(user) && data.kind !== "INITIAL") throw new AppError("FORBIDDEN", "Additional visits are arranged by your coordinator.");

  const slot = await db.availability.findUnique({ where: { id: data.availabilityId } });
  if (!slot) throw notFound("Slot");
  if (full.property && slot.regionPrefix !== postcodeArea(full.property.postcode)) throw badRequest("That slot isn't in this property's area.");

  await db.$transaction(async (tx) => {
    if (!(await reserveSlot(tx, slot.id))) throw conflict("That slot has just been taken. Please pick another.");
    // Re-booking an initial visit releases the old slot.
    for (const visit of full.visits.filter((item: any) => item.kind === data.kind)) {
      await tx.visit.update({ where: { id: visit.id }, data: { status: "CANCELLED" } });
      if (visit.availabilityId) await releaseSlot(tx, visit.availabilityId);
    }
    await tx.visit.create({ data: { projectId: full.id, availabilityId: slot.id, assessorId: slot.assessorId, date: slot.date, window: slot.window, kind: data.kind } });
    await tx.projectMember.createMany({ data: [{ projectId: full.id, userId: slot.assessorId }], skipDuplicates: true });
    await addActivity(tx, full.id, user.id, "visit.booked", `Site visit booked for ${slot.date.toISOString().slice(0, 10)} (${slot.window})`);
    await refreshProject(tx, full.id, { actorId: user.id });
  });
  return listVisits(user, reference);
}

export async function listVisits(user: AuthUser, reference: string) {
  const project = await findAccessibleProject(user, reference);
  const visits = await db.visit.findMany({ where: { projectId: project.id }, include: { assessor: { select: { firstName: true, lastName: true } } }, orderBy: { date: "asc" } });
  const settings = await getSettings();
  return visits.map((visit: any) => ({
    id: visit.id as string,
    date: (visit.date as Date).toISOString().slice(0, 10),
    window: visit.window as string,
    windowLabel: settings.booking.windows[visit.window as "AM" | "PM"],
    kind: visit.kind as string,
    status: visit.status as string,
    assessor: visit.assessor ? `${visit.assessor.firstName} ${visit.assessor.lastName}`.trim() : null,
    notes: isStaff(user) ? ((visit.notes as string | null) ?? null) : null,
  }));
}

export const visitOutcomeSchema = z.object({ status: z.enum(["COMPLETED", "NO_ACCESS", "CANCELLED"]), notes: z.string().trim().max(1_000).optional() });

/**
 * Staff record what happened. COMPLETED moves a SCHEDULED project into IN_PROGRESS.
 * NO_ACCESS is a failed visit: charged at the additional-visit rate (agreement clause 11)
 * and the project goes back to waiting for a new date.
 */
export async function recordVisitOutcome(user: AuthUser, visitId: string, input: z.input<typeof visitOutcomeSchema>) {
  if (!isStaff(user)) throw notFound("Visit");
  const data = visitOutcomeSchema.parse(input);
  const visit = await db.visit.findUnique({ where: { id: visitId }, include: { project: true } });
  if (!visit) throw notFound("Visit");
  await findAccessibleProject(user, visit.project.reference);
  const settings = await getSettings();

  await db.$transaction(async (tx) => {
    await tx.visit.update({ where: { id: visitId }, data: { status: data.status, notes: data.notes ?? visit.notes, completedAt: data.status === "COMPLETED" ? new Date() : null } });
    if (data.status !== "COMPLETED" && visit.availabilityId && data.status === "CANCELLED") await releaseSlot(tx, visit.availabilityId);
    if (data.status === "COMPLETED") {
      await addActivity(tx, visit.projectId, user.id, "visit.completed", "Site visit completed");
      if (visit.project.status === "SCHEDULED") await transitionProject(tx, visit.projectId, "IN_PROGRESS", { actorId: user.id });
    } else if (data.status === "NO_ACCESS") {
      const fee = settings.cancellation.failedVisitPence;
      if (fee > 0) {
        const vat = Math.round((fee * settings.vat.rateBps) / 10_000);
        await issueInvoice(tx, {
          userId: visit.project.clientId,
          kind: "CHARGE",
          description: `Failed site visit (no access) — ${visit.project.reference}`,
          lines: [{ description: `Failed visit ${visit.date.toISOString().slice(0, 10)} ${visit.window}`, netPence: fee, vatPence: vat, totalPence: fee + vat }],
          dueAt: new Date(Date.now() + 7 * 86_400_000),
          settings,
        });
      }
      await addActivity(tx, visit.projectId, user.id, "visit.no_access", "No access at the site visit. Please book a new date.");
      if (visit.project.status === "SCHEDULED") await transitionProject(tx, visit.projectId, "AWAITING_INFO", { actorId: user.id, note: "No access at visit" });
    } else {
      await addActivity(tx, visit.projectId, user.id, "visit.cancelled", "Site visit cancelled");
      await refreshProject(tx, visit.projectId, { actorId: user.id });
    }
  });
  return listVisits(user, visit.project.reference);
}
