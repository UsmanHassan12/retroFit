import "server-only";

import { z } from "zod";

import { db } from "../db";
import { notFound } from "../errors";
import { CUSTOMER_TYPES, MEASURES, SCHEMES, type CustomerTier } from "../domain";
import { evaluate, type ConditionContext } from "../rules/conditions";
import { getSettings } from "./settings";

/**
 * Booking intake (catalogue doc → "Common intake for every booking").
 *
 * Steps 1–4 (customer, address, property basics, occupant) are structured fields on the
 * user and the Property. Steps 5–7 (funding, installer, measures) and each service's own
 * questions are `IntakeQuestion` rows, so admins edit them as data. Step 8 is the visit slot
 * (Availability), step 9 the document list (ServiceDocumentRequirement), step 10 consent
 * (stored with version and timestamp on the order).
 *
 * Answers are stored as JSON and validated with a Zod schema built from the question rows.
 * Wrong types are rejected; missing required answers are reported, not thrown, so a booking
 * can be paid and the project waits in AWAITING_INFO until the client completes it.
 */

export type QuestionRow = {
  id: string;
  serviceId: string | null;
  key: string;
  label: string;
  help: string | null;
  type: string;
  options: unknown;
  required: boolean;
  condition: unknown;
  scope: string;
  step: number;
  position: number;
};

type Option = { value: string; label: string };

const optionsOf = (question: Pick<QuestionRow, "options">): Option[] =>
  Array.isArray(question.options)
    ? (question.options as unknown[]).flatMap((option) =>
        option && typeof option === "object" && "value" in option ? [{ value: String((option as Option).value), label: String((option as Option).label ?? (option as Option).value) }] : [],
      )
    : [];

export function toQuestionDto(question: QuestionRow) {
  return {
    key: question.key,
    label: question.label,
    help: question.help,
    type: question.type,
    options: optionsOf(question),
    required: question.required,
    condition: question.condition ?? null,
    scope: question.scope,
    step: question.step,
  };
}
export type QuestionDto = ReturnType<typeof toQuestionDto>;

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

function fieldSchema(question: QuestionRow): z.ZodType {
  const values = optionsOf(question).map((option) => option.value);
  switch (question.type) {
    case "NUMBER":
      return z.preprocess(emptyToUndefined, z.coerce.number({ message: `${question.label}: enter a number.` }).optional());
    case "SELECT":
      return z.preprocess(
        emptyToUndefined,
        (values.length ? z.enum(values as [string, ...string[]], { message: `${question.label}: choose one of the options.` }) : z.string().trim().max(200)).optional(),
      );
    case "MULTISELECT": {
      const item = values.length ? z.enum(values as [string, ...string[]], { message: `${question.label}: choose from the list.` }) : z.string().trim().max(200);
      return z.preprocess(
        (value) => (typeof value === "string" ? value.split(",").map((part) => part.trim()).filter(Boolean) : emptyToUndefined(value)),
        z.array(item).max(50).optional(),
      );
    }
    case "DATE":
      return z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${question.label}: use YYYY-MM-DD.`).optional());
    case "BOOLEAN":
      return z.preprocess((value) => (value === "true" || value === "on" ? true : value === "false" ? false : emptyToUndefined(value)), z.boolean().optional());
    case "FILE":
      // The file itself is uploaded to the project; the answer holds its document id or name.
      return z.preprocess(emptyToUndefined, z.string().trim().max(300).optional());
    default:
      return z.preprocess(emptyToUndefined, z.string().trim().max(2_000).optional());
  }
}

/** Zod schema for a set of questions. Unknown keys are dropped. */
export function buildAnswerSchema(questions: QuestionRow[]) {
  return z.object(Object.fromEntries(questions.map((question) => [question.key, fieldSchema(question)])));
}

const isBlank = (value: unknown) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/**
 * Validate answers. Returns only the answers whose question applies (conditions are
 * re-evaluated against the answers themselves) and the required ones still missing.
 */
export function checkAnswers(questions: QuestionRow[], raw: Record<string, unknown>, facts: ConditionContext, options: { lenient?: boolean } = {}) {
  // Lenient mode (re-checking saved answers after an admin edited a question): values that no
  // longer fit are treated as missing instead of failing the whole check.
  const parsed = (
    options.lenient
      ? Object.fromEntries(
          questions.flatMap((question) => {
            const result = fieldSchema(question).safeParse((raw ?? {})[question.key]);
            return result.success ? [[question.key, result.data]] : [];
          }),
        )
      : buildAnswerSchema(questions).parse(raw ?? {})
  ) as Record<string, unknown>;
  const context = { ...facts, ...parsed };
  const answers: Record<string, unknown> = {};
  const missing: Array<{ key: string; label: string }> = [];
  for (const question of questions) {
    if (!evaluate(question.condition, context)) continue;
    const value = parsed[question.key];
    if (!isBlank(value)) answers[question.key] = value;
    else if (question.required) missing.push({ key: question.key, label: question.label });
  }
  return { answers, missing };
}

/** Facts that conditions can use alongside the answers. */
export function intakeFacts(input: { tier: CustomerTier; serviceCodes: string[]; customerType?: string | null; tenure?: string | null }): ConditionContext {
  return { $tier: input.tier, $services: input.serviceCodes, $customerType: input.customerType ?? null, $tenure: input.tenure ?? null };
}

// ─── Loading ────────────────────────────────────────────────────────────────

const questionOrder = [{ step: "asc" as const }, { position: "asc" as const }];

export async function commonQuestions() {
  return (await db.intakeQuestion.findMany({ where: { serviceId: null, active: true }, orderBy: questionOrder })) as QuestionRow[];
}

export async function serviceQuestions(serviceIds: string[]) {
  const rows = (await db.intakeQuestion.findMany({ where: { serviceId: { in: serviceIds }, active: true }, orderBy: questionOrder })) as QuestionRow[];
  const byService = new Map<string, QuestionRow[]>();
  for (const row of rows) byService.set(row.serviceId!, [...(byService.get(row.serviceId!) ?? []), row]);
  return byService;
}

export function toRequirementDto(requirement: any) {
  return {
    key: requirement.key as string,
    label: requirement.label as string,
    required: requirement.required as boolean,
    condition: requirement.condition ?? null,
    timing: requirement.timing as string,
    acceptedTypes: requirement.acceptedTypes as string[],
    maxBytes: requirement.maxBytes as number,
  };
}

/**
 * GET /api/intake?services=RA,RD — the whole form for a booking: common questions, each
 * service's questions and document list, the enumerations for the property steps and the
 * consent text version. Conditions are returned so the UI can show/hide fields live.
 */
export async function getIntakeForm(input: { services: string[]; bundle?: string | null }) {
  let refs = input.services;
  if (input.bundle) {
    const bundle = await db.bundle.findFirst({ where: { OR: [{ id: input.bundle }, { code: input.bundle }, { slug: input.bundle }], active: true }, include: { items: { include: { service: true }, orderBy: { position: "asc" } } } });
    if (!bundle) throw notFound("Bundle");
    refs = [...refs, ...bundle.items.map((item: any) => item.service.id as string)];
  }
  const services = await db.service.findMany({
    where: { active: true, OR: [{ id: { in: refs } }, { code: { in: refs.map((ref) => ref.toUpperCase()) } }, { slug: { in: refs } }] },
    include: { documentRequirements: { orderBy: { position: "asc" } } },
    orderBy: { position: "asc" },
  });
  if (!services.length) throw notFound("Service");
  const [common, perService, settings] = await Promise.all([commonQuestions(), serviceQuestions(services.map((service: any) => service.id)), getSettings()]);

  return {
    steps: [
      { step: 1, key: "customer", title: "Customer" },
      { step: 2, key: "address", title: "Property address" },
      { step: 3, key: "property", title: "Property basics" },
      { step: 4, key: "occupant", title: "Occupant contact" },
      { step: 5, key: "funding", title: "Funding scheme" },
      { step: 6, key: "installer", title: "Installer" },
      { step: 7, key: "measures", title: "Measures" },
      { step: 8, key: "visit", title: "Visit slot" },
      { step: 9, key: "documents", title: "Documents" },
      { step: 10, key: "consent", title: "Consent" },
    ],
    enums: {
      customerTypes: CUSTOMER_TYPES,
      propertyTypes: ["house", "flat", "bungalow", "maisonette", "park home"],
      builtForms: ["detached", "semi-detached", "mid-terrace", "end-terrace"],
      tenures: ["owner-occupied", "private rented", "social"],
      schemes: SCHEMES,
      measures: MEASURES,
      visitWindows: settings.booking.windows,
    },
    common: common.map(toQuestionDto),
    services: services.map((service: any) => ({
      id: service.id as string,
      code: service.code as string,
      title: service.title as string,
      priceUnit: service.priceUnit as string,
      siteVisit: service.siteVisit as string,
      requiresProperty: service.requiresProperty as boolean,
      questions: (perService.get(service.id) ?? []).map(toQuestionDto),
      documents: service.documentRequirements.map(toRequirementDto),
    })),
    consent: {
      termsVersion: settings.booking.termsVersion,
      items: [
        { key: "acceptTerms", label: "I accept the terms of service.", required: true },
        { key: "gdprConsent", label: "I have the occupant's consent for their details to be processed (UK GDPR).", required: false },
        { key: "shareDataConsent", label: "StepSoft may share project data with the funder and TrustMark as needed for compliance.", required: false },
      ],
    },
  };
}
