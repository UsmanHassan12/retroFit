import { z } from "zod";

import type { WeeklySchedule } from "./rules/calendar";

/**
 * Commercial settings schema and defaults (no server-only import, so the seed and tests can
 * use it). Defaults are the draft placeholders from the catalogue doc (11 Nov 2026).
 * Runtime access goes through src/server/services/settings.ts.
 */

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour).");
const pence = z.number().int().min(0);
const bps = z.number().int().min(0).max(10_000);

export const SETTINGS_SCHEMA = {
  vat: z.object({ rateBps: bps.default(2_000) }),

  partner: z.object({
    /** Premium Partner subscription per month, excluding VAT. */
    subscriptionPence: pence.default(19_900),
    defaultDiscountBps: bps.default(1_000),
    minDiscountBps: bps.default(0),
    maxDiscountBps: bps.default(3_000),
    agreementVersion: z.string().min(1).default("2026-11-draft-1"),
    minTopupPence: pence.default(50_000),
    /** Default credit limit offered to weekly-invoice partners. Null = none. */
    defaultCreditLimitPence: pence.nullable().default(500_000),
    noticeDays: z.number().int().min(0).default(30),
  }),

  billing: z.object({
    timeZone: z.string().default("Europe/London"),
    /** 0 = Sunday … 6 = Saturday. */
    cutoffWeekday: z.number().int().min(0).max(6).default(5),
    cutoffTime: time.default("17:00"),
    dueDaysAfterCutoff: z.number().int().min(0).max(60).default(7),
    dueTime: time.default("18:00"),
    reminders: z
      .array(z.object({ key: z.string().min(1), daysBeforeDue: z.number().int().min(0).max(30), time }))
      .default([
        { key: "wednesday", daysBeforeDue: 2, time: "09:00" },
        { key: "due-day", daysBeforeDue: 0, time: "09:00" },
      ]),
    /** Hours after the due time before the account goes on hold. */
    graceHours: z.number().int().min(0).max(24 * 30).default(0),
    /** Which bookings a weekly invoice covers (open decision: billed on booking, start of work or delivery). */
    invoiceBasis: z.enum(["BOOKED", "STARTED", "DELIVERED"]).default("BOOKED"),
    /** Open decision: does a hold pause work in progress, or only block new bookings? */
    holdPausesWork: z.boolean().default(true),
    /** Move a partner from weekly to advance after a late payment (agreement clause 6). */
    switchToAdvanceAfterLatePayment: z.boolean().default(false),
  }),

  booking: z.object({
    timeZone: z.string().default("Europe/London"),
    /** Same-day desk calculations must be booked before this time. */
    sameDayCutoff: time.default("12:00"),
    /** Time of day a due date falls on. */
    dueTime: time.default("17:00"),
    termsVersion: z.string().min(1).default("2026-11-draft-1"),
    maxPropertiesPerOrder: z.number().int().min(1).max(5_000).default(200),
    windows: z
      .object({ AM: z.string().default("08:00–12:00"), PM: z.string().default("12:00–18:00") })
      .default({ AM: "08:00–12:00", PM: "12:00–18:00" }),
    /** How many days ahead customers may book a visit. */
    bookingHorizonDays: z.number().int().min(1).max(365).default(60),
  }),

  cancellation: z.object({
    visitBookedPercent: z.number().min(0).max(100).default(0),
    workStartedPercent: z.number().min(0).max(100).default(50),
    withinHoursOfVisit: z.number().int().min(0).max(240).default(24),
    deliveredPercent: z.number().min(0).max(100).default(100),
    /** Failed visit (no access) — charged at the additional-visit rate. */
    failedVisitPence: pence.default(15_000),
  }),

  revisions: z.object({
    /** Price of each extra revision round beyond the included ones (placeholder). */
    extraRoundPence: pence.default(9_500),
  }),

  seller: z.object({
    name: z.string().default("STEPSOFT LTD"),
    tradingAs: z.string().default("StepSoft Coordination Services / Retrofit Portal"),
    address: z.string().default("Address to be confirmed"),
    vatNumber: z.string().default("VAT number to be confirmed"),
    email: z.string().default("accounts@stepsoft.co.uk"),
  }),
} as const;

export type SettingsSection = keyof typeof SETTINGS_SCHEMA;
export type Settings = { [K in SettingsSection]: z.output<(typeof SETTINGS_SCHEMA)[K]> };
export const SETTINGS_SECTIONS = Object.keys(SETTINGS_SCHEMA) as SettingsSection[];

export function parseSection<K extends SettingsSection>(key: K, value: unknown): Settings[K] {
  const result = SETTINGS_SCHEMA[key].safeParse(value ?? {});
  if (result.success) return result.data as Settings[K];
  // A bad stored value must never take checkout down: fall back to defaults and log loudly.
  console.error(`[settings] Invalid stored value for "${key}", using defaults`, result.error.issues);
  return SETTINGS_SCHEMA[key].parse({}) as Settings[K];
}

export const defaultSettings = (): Settings =>
  Object.fromEntries(SETTINGS_SECTIONS.map((key) => [key, SETTINGS_SCHEMA[key].parse({})])) as Settings;

export function weeklySchedule(settings: Settings): WeeklySchedule {
  return {
    timeZone: settings.billing.timeZone,
    cutoffWeekday: settings.billing.cutoffWeekday,
    cutoffTime: settings.billing.cutoffTime,
    dueDaysAfterCutoff: settings.billing.dueDaysAfterCutoff,
    dueTime: settings.billing.dueTime,
  };
}

