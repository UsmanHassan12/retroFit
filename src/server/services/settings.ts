import "server-only";

import { cache } from "react";
import { z } from "zod";

import { db } from "../db";
import { badRequest } from "../errors";
import { parseSection, SETTINGS_SCHEMA, SETTINGS_SECTIONS, type Settings, type SettingsSection } from "../settings-schema";
import { audit } from "./audit";

export { defaultSettings, SETTINGS_SCHEMA, SETTINGS_SECTIONS, weeklySchedule } from "../settings-schema";
export type { Settings, SettingsSection } from "../settings-schema";

/**
 * Commercial settings. Every price, percentage, cut-off and deadline that isn't a catalogue
 * row lives here, so StepSoft's final sheet is a data change, not a code change.
 *
 * Each section is one `Setting` row (key = section name, value = JSON). Missing rows or
 * missing fields fall back to the defaults in ../settings-schema.ts: the draft placeholders from the
 * catalogue doc (11 Nov 2026). Admins edit them at /api/admin/settings/commercial.
 */

async function load(): Promise<Settings> {
  const rows = await db.setting.findMany({ where: { key: { in: SETTINGS_SECTIONS } } });
  const stored = new Map(rows.map((row: { key: string; value: unknown }) => [row.key, row.value]));
  return Object.fromEntries(SETTINGS_SECTIONS.map((key) => [key, parseSection(key, stored.get(key))])) as Settings;
}

/** Memoised per request. Background jobs call it once per run. */
export const getSettings = cache(load);

/** Admin: replace one section (validated; unknown fields dropped). */
export async function updateSettingsSection(actorId: string, key: string, value: unknown) {
  if (!(SETTINGS_SECTIONS as string[]).includes(key)) throw badRequest(`Unknown settings section "${key}".`);
  const section = key as SettingsSection;
  const current = (await load())[section];
  const parsed = SETTINGS_SCHEMA[section].parse({ ...current, ...(value as object) });
  if (section === "partner") {
    const partner = parsed as Settings["partner"];
    if (partner.minDiscountBps > partner.maxDiscountBps) throw badRequest("The minimum discount can't be above the maximum.");
    if (partner.defaultDiscountBps < partner.minDiscountBps || partner.defaultDiscountBps > partner.maxDiscountBps) {
      throw badRequest("The default discount must sit inside the allowed range.");
    }
  }
  await db.setting.upsert({
    where: { key: section },
    create: { key: section, value: parsed as never, updatedById: actorId },
    update: { value: parsed as never, updatedById: actorId },
  });
  await audit(actorId, "settings.update", "Setting", section, parsed as Record<string, unknown>);
  return parsed;
}

// ─── Bank holidays ──────────────────────────────────────────────────────────

const loadHolidays = cache(async () => {
  const rows = await db.bankHoliday.findMany({ select: { date: true } });
  return new Set<string>(rows.map((row: { date: Date }) => row.date.toISOString().slice(0, 10)));
});

export const getBankHolidays = loadHolidays;

export async function listBankHolidays() {
  const rows = await db.bankHoliday.findMany({ orderBy: { date: "asc" } });
  return rows.map((row: { date: Date; name: string }) => ({ date: row.date.toISOString().slice(0, 10), name: row.name }));
}

export const bankHolidaysSchema = z.array(
  z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."), name: z.string().trim().min(1).max(80) }),
);

/** Replace the bank-holiday list for the years present in the payload. */
export async function saveBankHolidays(actorId: string, input: unknown) {
  const holidays = bankHolidaysSchema.parse(input);
  const years = [...new Set(holidays.map((holiday) => Number(holiday.date.slice(0, 4))))];
  await db.$transaction(async (tx) => {
    for (const year of years) {
      await tx.bankHoliday.deleteMany({ where: { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } } });
    }
    await tx.bankHoliday.createMany({ data: holidays.map((holiday) => ({ date: new Date(holiday.date), name: holiday.name })) });
  });
  await audit(actorId, "bank_holidays.save", "BankHoliday", years.join(","));
  return listBankHolidays();
}
