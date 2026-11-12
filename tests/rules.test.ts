/**
 * Commercial rules from "Draft Service Catalogue & Commercial Rules" (11 Nov 2026).
 * Pure functions only: pricing, UK calendar, conditions, workflow, cancellation, CSV.
 * Run: npm test
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { addDays, billingPeriod, dueDate, latestCutoff, localDate, localParts, reminderTimes, zonedTime, type WeeklySchedule } from "../src/server/rules/calendar";
import { evaluate, isCondition } from "../src/server/rules/conditions";
import { parseCsv } from "../src/server/rules/csv";
import { allocateBundle, chooseDiscount, partnerDiscountBps, priceLine, sumLines } from "../src/server/rules/pricing";
import { canTransition, cancellationPercent, readinessStatus } from "../src/server/rules/workflow";

const VAT = 2000;

// ─── Pricing ────────────────────────────────────────────────────────────────

test("pricing: Basic customer pays list price + VAT (Retrofit Assessment £225)", () => {
  const line = priceLine({ unitPricePence: 22_500, quantity: 1, discountBps: 0, addons: [], vatBps: VAT });
  assert.equal(line.netPence, 22_500);
  assert.equal(line.vatPence, 4_500);
  assert.equal(line.totalPence, 27_000);
});

test("pricing: per-element quantity × unit price (4 U-values at £45)", () => {
  const line = priceLine({ unitPricePence: 4_500, quantity: 4, discountBps: 0, addons: [], vatBps: VAT });
  assert.equal(line.listPence, 18_000);
  assert.equal(line.totalPence, 21_600);
});

test("pricing: list → partner discount → add-ons → VAT (add-ons are not discounted)", () => {
  // £225 RA, 10% partner discount, extra visit £150, travel 40 miles at 45p beyond 30.
  const line = priceLine({
    unitPricePence: 22_500,
    quantity: 1,
    discountBps: 1_000,
    addons: [
      { key: "extra-visit", name: "Additional site visit", kind: "PER_UNIT", amount: 15_000, quantity: 1 },
      { key: "travel", name: "Travel", kind: "PER_MILE", amount: 45, freeAllowance: 30, quantity: 40 },
    ],
    vatBps: VAT,
  });
  assert.equal(line.discountPence, 2_250);
  assert.equal(line.addonsPence, 15_000 + 450);
  assert.equal(line.netPence, 22_500 - 2_250 + 15_450);
  assert.equal(line.vatPence, Math.round(line.netPence * 0.2));
});

test("pricing: Express +30% is a percentage of list price", () => {
  const line = priceLine({ unitPricePence: 29_500, quantity: 1, discountBps: 0, addons: [{ key: "express", name: "Express", kind: "PERCENT_OF_LIST", amount: 3_000 }], vatBps: VAT });
  assert.equal(line.addonsPence, 8_850);
  assert.equal(line.netPence, 38_350);
});

test("pricing: travel inside the free allowance costs nothing", () => {
  const line = priceLine({ unitPricePence: 10_000, quantity: 1, discountBps: 0, addons: [{ key: "travel", name: "Travel", kind: "PER_MILE", amount: 45, freeAllowance: 30, quantity: 12 }], vatBps: VAT });
  assert.equal(line.addonsPence, 0);
});

test("pricing: partner discount and a code never stack, the larger wins", () => {
  assert.deepEqual(chooseDiscount({ discountable: true, partnerBps: 1_000, codeBps: 500 }), { bps: 1_000, source: "PARTNER" });
  assert.deepEqual(chooseDiscount({ discountable: true, partnerBps: 1_000, codeBps: 1_500 }), { bps: 1_500, source: "CODE" });
  assert.deepEqual(chooseDiscount({ discountable: false, partnerBps: 1_000, codeBps: 1_500 }), { bps: 0, source: "NONE" });
});

test("pricing: per-service override beats the default and is clamped to 0–30%", () => {
  assert.equal(partnerDiscountBps({ defaultBps: 1_000, overrideBps: 2_000, minBps: 0, maxBps: 3_000 }), 2_000);
  assert.equal(partnerDiscountBps({ defaultBps: 1_000, overrideBps: null, minBps: 0, maxBps: 3_000 }), 1_000);
  assert.equal(partnerDiscountBps({ defaultBps: 5_000, minBps: 0, maxBps: 3_000 }), 3_000);
});

test("pricing: bundle price is shared by list price and adds up exactly", () => {
  const shares = allocateBundle(85_000, [22_500, 29_500, 45_000]);
  assert.equal(shares.reduce((a, b) => a + b, 0), 85_000);
  assert.ok(shares[2]! > shares[1]! && shares[1]! > shares[0]!);
});

test("pricing: order totals are the sum of the lines", () => {
  const a = priceLine({ unitPricePence: 333, quantity: 1, discountBps: 1_000, addons: [], vatBps: VAT });
  const b = priceLine({ unitPricePence: 4_500, quantity: 2, discountBps: 0, addons: [], vatBps: VAT });
  const totals = sumLines([a, b]);
  assert.equal(totals.totalPence, a.totalPence + b.totalPence);
  assert.equal(a.discountPence, 33); // half-up rounding
});

// ─── Calendar ───────────────────────────────────────────────────────────────

const HOLIDAYS = new Set(["2026-12-25", "2026-12-28", "2027-01-01"]);

test("calendar: London wall clock handles GMT and BST", () => {
  assert.equal(zonedTime("2026-11-13", "17:00").toISOString(), "2026-11-13T17:00:00.000Z"); // GMT
  assert.equal(zonedTime("2026-07-10", "17:00").toISOString(), "2026-07-10T16:00:00.000Z"); // BST
  assert.equal(localParts(new Date("2026-07-10T16:00:00Z")).hour, 17);
});

test("calendar: working days skip weekends and bank holidays", () => {
  // Thu 24 Dec 2026 + 2 working days → Thu 24 → (Fri 25 hol, Sat, Sun, Mon 28 hol) → Tue 29, Wed 30.
  const due = dueDate({ start: zonedTime("2026-12-24", "10:00"), days: 2, holidays: HOLIDAYS });
  assert.equal(localDate(due), "2026-12-30");
});

test("calendar: same-day only before the 12:00 cut-off", () => {
  const before = dueDate({ start: zonedTime("2026-11-11", "11:30"), days: 0, holidays: HOLIDAYS, sameDayCutoff: "12:00" });
  const after = dueDate({ start: zonedTime("2026-11-11", "12:30"), days: 0, holidays: HOLIDAYS, sameDayCutoff: "12:00" });
  assert.equal(localDate(before), "2026-11-11");
  assert.equal(localDate(after), "2026-11-12");
  const saturday = dueDate({ start: zonedTime("2026-11-14", "09:00"), days: 0, holidays: HOLIDAYS });
  assert.equal(localDate(saturday), "2026-11-16");
});

const WEEKLY: WeeklySchedule = { timeZone: "Europe/London", cutoffWeekday: 5, cutoffTime: "17:00", dueDaysAfterCutoff: 7, dueTime: "18:00" };

test("calendar: weekly cut-off is Friday 17:00 UK and payment is due next Friday 18:00", () => {
  const cutoff = latestCutoff(new Date("2026-11-11T12:00:00Z"), WEEKLY); // Wednesday
  assert.equal(cutoff.toISOString(), "2026-11-06T17:00:00.000Z");
  const exactly = latestCutoff(new Date("2026-11-13T17:00:00Z"), WEEKLY);
  assert.equal(exactly.toISOString(), "2026-11-13T17:00:00.000Z");
  const period = billingPeriod(exactly, WEEKLY);
  assert.equal(period.start.toISOString(), "2026-11-06T17:00:00.000Z");
  assert.equal(period.due.toISOString(), "2026-11-20T18:00:00.000Z");
});

test("calendar: cut-off follows BST in summer", () => {
  const cutoff = latestCutoff(new Date("2026-07-11T08:00:00Z"), WEEKLY);
  assert.equal(cutoff.toISOString(), "2026-07-10T16:00:00.000Z");
});

test("calendar: reminders on Wednesday and on the morning of the due date", () => {
  const due = zonedTime("2026-11-20", "18:00");
  const times = reminderTimes(due, [
    { key: "wednesday", daysBeforeDue: 2, time: "09:00" },
    { key: "due-day", daysBeforeDue: 0, time: "09:00" },
  ]);
  assert.equal(localDate(times[0]!.at), "2026-11-18");
  assert.equal(times[1]!.at.toISOString(), "2026-11-20T09:00:00.000Z");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

// ─── Conditions ─────────────────────────────────────────────────────────────

test("conditions: show-if, includes and nested all/any", () => {
  assert.equal(evaluate({ key: "scheme", op: "eq", value: "ECO4" }, { scheme: "ECO4" }), true);
  assert.equal(evaluate({ key: "$services", op: "notIncludes", value: "RA" }, { $services: ["RA", "RD"] }), false);
  const installer = { all: [{ key: "$tier", op: "eq", value: "PARTNER" }, { key: "scheme", op: "in", value: ["ECO4", "GBIS"] }] };
  assert.equal(evaluate(installer, { $tier: "PARTNER", scheme: "GBIS" }), true);
  assert.equal(evaluate(installer, { $tier: "BASIC", scheme: "GBIS" }), false);
  assert.equal(evaluate(null, {}), true);
  assert.equal(isCondition({ key: "x", op: "nope" }), false);
});

// ─── Workflow ───────────────────────────────────────────────────────────────

test("workflow: readiness picks the starting status", () => {
  assert.equal(readinessStatus({ intakeComplete: false, documentsComplete: true, needsVisit: false, visitBooked: false }), "AWAITING_INFO");
  assert.equal(readinessStatus({ intakeComplete: true, documentsComplete: true, needsVisit: true, visitBooked: true }), "SCHEDULED");
  assert.equal(readinessStatus({ intakeComplete: true, documentsComplete: true, needsVisit: false, visitBooked: false }), "IN_PROGRESS");
});

test("workflow: revision loops back, completed is final", () => {
  assert.equal(canTransition("DELIVERED", "REVISION"), true);
  assert.equal(canTransition("REVISION", "IN_PROGRESS"), true);
  assert.equal(canTransition("COMPLETED", "IN_PROGRESS"), false);
  assert.equal(canTransition("AWAITING_INFO", "DELIVERED"), false);
});

const CANCEL = { visitBookedPercent: 0, workStartedPercent: 50, withinHoursOfVisit: 24, deliveredPercent: 100 };

test("cancellation: free → 50% → 100%", () => {
  const now = new Date("2026-11-11T10:00:00Z");
  assert.equal(cancellationPercent({ status: "AWAITING_INFO", workStarted: false, delivered: false, nextVisitAt: null, now }, CANCEL).percent, 0);
  assert.equal(cancellationPercent({ status: "SCHEDULED", workStarted: false, delivered: false, nextVisitAt: new Date("2026-11-11T20:00:00Z"), now }, CANCEL).percent, 50);
  assert.equal(cancellationPercent({ status: "SCHEDULED", workStarted: false, delivered: false, nextVisitAt: new Date("2026-11-20T09:00:00Z"), now }, CANCEL).percent, 0);
  assert.equal(cancellationPercent({ status: "IN_PROGRESS", workStarted: true, delivered: false, nextVisitAt: null, now }, CANCEL).percent, 50);
  assert.equal(cancellationPercent({ status: "DELIVERED", workStarted: true, delivered: true, nextVisitAt: null, now }, CANCEL).percent, 100);
});

// ─── CSV ────────────────────────────────────────────────────────────────────

test("csv: quoted fields, commas and CRLF", () => {
  const rows = parseCsv('﻿Address Line 1,City,Postcode,Reference\r\n"1, The Mews",Leeds,LS1 4AB,"A ""B"""\r\n\r\n2 High St,York,YO1 7HH,\r\n');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { address_line_1: "1, The Mews", city: "Leeds", postcode: "LS1 4AB", reference: 'A "B"' });
  assert.equal(rows[1]!.reference, "");
});
