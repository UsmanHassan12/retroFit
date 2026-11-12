/**
 * UK business calendar. Pure functions, no dependencies.
 *
 * Everything commercial happens on UK local time (billing cut-off Friday 17:00, payment due
 * 18:00, same-day calculations before 12:00), so instants are converted to and from
 * Europe/London explicitly. That keeps BST/GMT changes correct even when the server runs
 * in UTC. Calendar dates are handled as "YYYY-MM-DD" strings.
 */

export const DEFAULT_TIMEZONE = "Europe/London";

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let value = formatters.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    formatters.set(timeZone, value);
  }
  return value;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock parts of an instant in a time zone. weekday: 0 = Sunday … 6 = Saturday. */
export function localParts(instant: Date, timeZone = DEFAULT_TIMEZONE): LocalParts {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday as string] ?? 0,
  };
}

function offsetMs(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock in `timeZone` reads `ymd hh:mm`. */
export function zonedTime(ymd: string, time: string, timeZone = DEFAULT_TIMEZONE): Date {
  const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
  const [hour, minute] = parseTime(time);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let instant = guess - offsetMs(new Date(guess), timeZone);
  // Re-check once: the offset can differ either side of a DST change.
  const corrected = guess - offsetMs(new Date(instant), timeZone);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

export function parseTime(time: string): [number, number] {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) throw new Error(`Invalid time "${time}" (expected HH:MM).`);
  return [Number(match[1]), Number(match[2])];
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Local calendar date of an instant, "YYYY-MM-DD". */
export function localDate(instant: Date, timeZone = DEFAULT_TIMEZONE) {
  const parts = localParts(instant, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Calendar arithmetic on "YYYY-MM-DD" (no time zone involved). */
export function addDays(ymd: string, days: number) {
  const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function weekdayOf(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export const ymdOf = (date: Date) => date.toISOString().slice(0, 10);

export function isWorkingDay(ymd: string, holidays: ReadonlySet<string>) {
  const weekday = weekdayOf(ymd);
  return weekday !== 0 && weekday !== 6 && !holidays.has(ymd);
}

export function nextWorkingDay(ymd: string, holidays: ReadonlySet<string>) {
  let current = addDays(ymd, 1);
  while (!isWorkingDay(current, holidays)) current = addDays(current, 1);
  return current;
}

/**
 * Due date for a turnaround of `days` working days from `start` (catalogue: "Due date =
 * paid date (or visit date) + standardDays or fastTrackDays, counting working days and
 * skipping UK bank holidays").
 *  - days = 0 means same day, but only when started on a working day before `sameDayCutoff`;
 *    otherwise it rolls to the next working day.
 *  - The result is `dueTime` local time on the due day.
 */
export function dueDate(input: {
  start: Date;
  days: number;
  holidays: ReadonlySet<string>;
  sameDayCutoff?: string;
  dueTime?: string;
  timeZone?: string;
}) {
  const timeZone = input.timeZone ?? DEFAULT_TIMEZONE;
  const startDay = localDate(input.start, timeZone);
  let day: string;
  if (input.days <= 0) {
    const cutoff = zonedTime(startDay, input.sameDayCutoff ?? "12:00", timeZone);
    day = isWorkingDay(startDay, input.holidays) && input.start < cutoff ? startDay : nextWorkingDay(startDay, input.holidays);
  } else {
    day = startDay;
    for (let counted = 0; counted < input.days; counted++) day = nextWorkingDay(day, input.holidays);
  }
  return zonedTime(day, input.dueTime ?? "17:00", timeZone);
}

/** Working days between two instants' local dates (exclusive of the start day). */
export function workingDaysBetween(from: Date, to: Date, holidays: ReadonlySet<string>, timeZone = DEFAULT_TIMEZONE) {
  let day = localDate(from, timeZone);
  const end = localDate(to, timeZone);
  let count = 0;
  while (day < end) {
    day = addDays(day, 1);
    if (isWorkingDay(day, holidays)) count++;
  }
  return count;
}

// ─── Weekly billing ─────────────────────────────────────────────────────────

export type WeeklySchedule = {
  timeZone: string;
  /** 0 = Sunday … 6 = Saturday. Draft rule: Friday (5) at 17:00. */
  cutoffWeekday: number;
  cutoffTime: string;
  /** Payment due this many calendar days after the cut-off day, at `dueTime` (draft: 7, 18:00). */
  dueDaysAfterCutoff: number;
  dueTime: string;
};

/** The latest cut-off instant at or before `now`. */
export function latestCutoff(now: Date, schedule: WeeklySchedule) {
  let day = localDate(now, schedule.timeZone);
  for (let step = 0; step < 8; step++) {
    if (weekdayOf(day) === schedule.cutoffWeekday) {
      const instant = zonedTime(day, schedule.cutoffTime, schedule.timeZone);
      if (instant <= now) return instant;
    }
    day = addDays(day, -1);
  }
  throw new Error("Could not find the billing cut-off.");
}

/**
 * Billing period ending at `cutoff`: (previous cut-off, cut-off]. Using the previous cut-off as
 * the start means no booking falls in a gap (the draft says "Saturday 00:00 to Friday 17:00",
 * which would leave Friday evening unbilled).
 */
export function billingPeriod(cutoff: Date, schedule: WeeklySchedule) {
  const day = localDate(cutoff, schedule.timeZone);
  const start = zonedTime(addDays(day, -7), schedule.cutoffTime, schedule.timeZone);
  const due = zonedTime(addDays(day, schedule.dueDaysAfterCutoff), schedule.dueTime, schedule.timeZone);
  return { start, end: cutoff, due };
}

export type Reminder = { key: string; daysBeforeDue: number; time: string };

/** When each reminder for an invoice due at `due` should go out. */
export function reminderTimes(due: Date, reminders: Reminder[], timeZone = DEFAULT_TIMEZONE) {
  const dueDay = localDate(due, timeZone);
  return reminders.map((reminder) => ({ key: reminder.key, at: zonedTime(addDays(dueDay, -reminder.daysBeforeDue), reminder.time, timeZone) }));
}
