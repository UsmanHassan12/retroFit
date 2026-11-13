"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser, requireStaffUser } from "@/server/auth/session";
import { EMAIL_TEMPLATE_KEYS } from "@/server/domain";
import { AppError } from "@/server/errors";
import { fieldErrors, messageFor } from "@/server/http";
import * as admin from "@/server/services/admin";
import { impersonate } from "@/server/services/auth";
import { createService, patchService } from "@/server/services/catalog";
import { addDeliverableVersion, createDeliverable, deleteDeliverable, updateDeliverable } from "@/server/services/deliverables";
import { deleteDocument } from "@/server/services/documents";
import { offerTerms, setServiceDiscounts, updatePartner } from "@/server/services/partners";
import { advanceStage, decideRevision, updateProject } from "@/server/services/projects";

/**
 * Admin mutations. Each action re-checks the caller's role on the server (never rely on the
 * UI hiding a button) and delegates to the services in src/server/services.
 */

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string> };

function failure(error: unknown, fallback = "Please fix the highlighted fields."): FormState {
  if (error instanceof z.ZodError) return { ok: false, message: fallback, errors: fieldErrors(error) };
  if (error instanceof AppError && error.details && typeof error.details === "object") {
    return { ok: false, message: error.message, errors: error.details as Record<string, string> };
  }
  return { ok: false, message: messageFor(error) };
}

// ─── Services ───────────────────────────────────────────────────────────────

export type ServiceFormInput = {
  code: string;
  title: string;
  description: string;
  category: string;
  active: boolean;
  imageUrl?: string;
  priceUnit: string;
  listPrice: string;
  siteVisit: string;
  standardDays: string;
  fastTrackDays: string;
  revisionRounds: string;
  stages: { name: string; role: string; slaDays: string; status: string }[];
  deliverables: string[];
};

const days = (value: string) => (value.trim() === "" ? null : Math.max(0, Math.round(Number(value))));

/**
 * "Add New Service" form → catalogue. Prices arrive in pounds and are stored in pence.
 * Questions, document lists and add-ons are edited through the API (PUT /api/admin/services/:id).
 */
export async function saveService(input: ServiceFormInput): Promise<FormState> {
  try {
    const user = await requireAdminUser();
    await createService(user.id, {
      code: input.code,
      title: input.title,
      summary: input.description,
      category: input.category as never,
      active: input.active,
      ...(input.imageUrl ? { imageUrl: input.imageUrl, gallery: [input.imageUrl] } : {}),
      priceUnit: input.priceUnit as never,
      listPricePence: Math.round(Number(input.listPrice) * 100) || 0,
      siteVisit: input.siteVisit as never,
      standardDays: days(input.standardDays),
      fastTrackDays: days(input.fastTrackDays),
      revisionRounds: Math.round(Number(input.revisionRounds)) || 0,
      stages: input.stages.map((stage) => ({
        name: stage.name,
        defaultRole: stage.role as never,
        slaDays: days(stage.slaDays),
        projectStatus: (stage.status || null) as never,
        boardColumn: ({ ASSESSOR: "ASSESSMENT", DESIGNER: "DESIGN", COORDINATOR: "COORDINATION", ADMIN: "BACKLOG" } as Record<string, string>)[stage.role] as never,
      })),
      serviceDeliverables: input.deliverables.filter(Boolean).map((name) => ({ name })),
      included: input.deliverables.filter(Boolean),
    });
  } catch (error) {
    const state = failure(error);
    // Map server field names back to the form's (listPricePence → listPrice, summary → description).
    if (state.errors) {
      state.errors = Object.fromEntries(
        Object.entries(state.errors).map(([key, value]) => [key.replace(/^listPricePence$/, "listPrice").replace(/^summary$/, "description").replace(/^serviceDeliverables/, "deliverables"), value]),
      );
    }
    return state;
  }
  revalidatePath("/", "layout");
  redirect("/admin/services");
}

export async function setServiceActive(serviceId: string, active: boolean) {
  const user = await requireAdminUser();
  await patchService(user.id, serviceId, { active });
  revalidatePath("/", "layout");
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function inviteStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireAdminUser();
    const result = await admin.inviteUser(user, {
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? "").toUpperCase() as never,
      canViewAllProjects: formData.get("viewAll") === "on",
      projectIds: formData.get("assignSpecific") === "on" ? formData.getAll("projectIds").map(String) : [],
    });
    revalidatePath("/admin/users");
    return { ok: true, message: `Invitation sent to ${result.email}.` };
  } catch (error) {
    return failure(error, "Please check the invitation details.");
  }
}

export async function setUserStatus(userId: string, status: "ACTIVE" | "SUSPENDED"): Promise<FormState> {
  try {
    const user = await requireAdminUser();
    await admin.updateUser(user, userId, { status });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Sign in as a client or staff member (≤ 1 hour) to see exactly what they see. */
export async function impersonateUser(userId: string) {
  const user = await requireAdminUser();
  const target = await impersonate(user.id, userId);
  redirect(target.role === "CLIENT" ? "/dashboard" : "/admin");
}

// ─── Settings ───────────────────────────────────────────────────────────────

const templateKey = z.enum(EMAIL_TEMPLATE_KEYS);

export async function saveEmailTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireAdminUser();
    const key = templateKey.parse(formData.get("key"));
    if (formData.get("intent") === "reset") {
      await admin.resetTemplate(user, key);
      revalidatePath("/admin/settings");
      return { ok: true, message: "Template reset to the default." };
    }
    await admin.saveTemplate(user, key, { subject: String(formData.get("subject") ?? ""), html: String(formData.get("template") ?? "") });
  } catch (error) {
    return failure(error, "The template couldn’t be saved.");
  }
  revalidatePath("/admin/settings");
  return { ok: true, message: "Template saved." };
}

// ─── Projects ───────────────────────────────────────────────────────────────

export async function updateProjectAction(reference: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireStaffUser();
    const value = (key: string) => {
      const raw = formData.get(key);
      return raw === null ? undefined : String(raw);
    };
    const coordinatorId = value("coordinatorId");
    const due = value("dueDate");
    const issue = value("issueSummary")?.trim();
    // Stage first: it may move the status itself.
    const stage = value("stage");
    if (stage !== undefined && stage !== value("originalStage")) await advanceStage(user, reference, { position: Number(stage) });
    const status = value("status");
    await updateProject(user, reference, {
      ...(status && status !== value("originalStatus") ? { status: status as never } : {}),
      health: value("health") as never,
      priority: value("priority") as never,
      ...(due !== undefined ? { dueDate: due ? new Date(due) : null } : {}),
      ...(issue !== undefined ? { issueSummary: issue || null, hasIssues: Boolean(issue), criticalIssue: formData.get("criticalIssue") === "on" && Boolean(issue) } : {}),
      ...(value("phaseNotice") !== undefined ? { phaseNotice: value("phaseNotice")?.trim() || null } : {}),
      ...(coordinatorId !== undefined && (user.role === "ADMIN" || user.role === "COORDINATOR") ? { coordinatorId: coordinatorId || null } : {}),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/projects/${reference}`);
  return { ok: true, message: "Project updated." };
}

// ─── Project workspace (deliverables, documents, revisions) ─────────────────

/** Refresh the staff page and the client's project pages after a workspace change. */
function refreshProjectPages(reference: string) {
  revalidatePath(`/admin/projects/${reference}`);
  revalidatePath(`/dashboard/projects/${reference}`, "layout");
}

/**
 * Issue a report to the client: the file is already uploaded to the project (browser →
 * storage); this attaches it as the deliverable's next version and makes it downloadable.
 */
export async function issueDeliverableVersion(input: {
  reference: string;
  deliverableId: string;
  documentId: string;
  label?: "INITIAL" | "REVISED" | "FINAL";
  note?: string;
}): Promise<FormState> {
  try {
    const user = await requireStaffUser();
    await addDeliverableVersion(user, input.deliverableId, { documentId: input.documentId, label: input.label, note: input.note || undefined });
    refreshProjectPages(input.reference);
    return { ok: true, message: "Issued. The client can download it now." };
  } catch (error) {
    return failure(error);
  }
}

export async function addProjectDeliverable(input: { reference: string; title: string; kind: "PDF" | "SPREADSHEET" | "REPORT" }): Promise<FormState> {
  try {
    const user = await requireStaffUser();
    await createDeliverable(user, input.reference, { title: input.title, kind: input.kind });
    refreshProjectPages(input.reference);
    return { ok: true, message: "Deliverable added." };
  } catch (error) {
    return failure(error, "Give the deliverable a name of at least 2 characters.");
  }
}

export async function setDeliverableStatus(input: { reference: string; deliverableId: string; status: "PENDING" | "IN_PROGRESS" }): Promise<FormState> {
  try {
    const user = await requireStaffUser();
    await updateDeliverable(user, input.deliverableId, { status: input.status });
    refreshProjectPages(input.reference);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function removeDeliverable(input: { reference: string; deliverableId: string }): Promise<FormState> {
  try {
    const user = await requireStaffUser();
    await deleteDeliverable(user, input.deliverableId);
    refreshProjectPages(input.reference);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function removeProjectDocument(input: { reference: string; documentId: string }): Promise<FormState> {
  try {
    const user = await requireStaffUser();
    await deleteDocument(user, input.reference, input.documentId);
    refreshProjectPages(input.reference);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Accept (invoicing billable rounds at the given price) or decline an extra revision. */
export async function decideRevisionRequest(input: { reference: string; revisionId: string; accept: boolean; price?: string }): Promise<FormState> {
  try {
    const user = await requireStaffUser();
    const pricePence = input.price !== undefined && input.price.trim() !== "" ? Math.round(Number(input.price) * 100) : undefined;
    if (pricePence !== undefined && (!Number.isFinite(pricePence) || pricePence < 0)) return { ok: false, message: "Enter a price in pounds, e.g. 95." };
    await decideRevision(user, input.revisionId, { accept: input.accept, pricePence });
    refreshProjectPages(input.reference);
    return { ok: true, message: input.accept ? "Revision accepted. The project is back in progress." : "Revision declined." };
  } catch (error) {
    return failure(error);
  }
}

// ─── Partners (admin approval and management) ───────────────────────────────

const percentToBps = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  if (text === "") return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
};
const poundsToPence = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim().replace(/[£,]/g, "");
  if (text === "") return null;
  const number = Number(text);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
};

function refreshPartnerPages(id: string) {
  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${id}`);
}

/** Read the terms fields shared by the approve and edit forms. */
function termsFrom(formData: FormData) {
  const discountBps = percentToBps(formData.get("discount"));
  const creditLimitPence = poundsToPence(formData.get("creditLimit"));
  const paymentMode = String(formData.get("paymentMode") ?? "") as "ADVANCE" | "WEEKLY";
  const errors: Record<string, string> = {};
  if (Number.isNaN(discountBps)) errors.discount = "Enter a percentage, e.g. 10.";
  if (Number.isNaN(creditLimitPence)) errors.creditLimit = "Enter an amount in pounds, e.g. 5000.";
  if (paymentMode !== "ADVANCE" && paymentMode !== "WEEKLY") errors.paymentMode = "Choose how the partner pays.";
  return { discountBps, creditLimitPence: paymentMode === "ADVANCE" ? null : creditLimitPence, paymentMode, errors };
}

/** Approve an application with terms → OFFERED; the partner is emailed to sign and subscribe. */
export async function approvePartner(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireAdminUser();
    const terms = termsFrom(formData);
    if (Object.keys(terms.errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors: terms.errors };
    await offerTerms(user.id, id, { discountBps: terms.discountBps, paymentMode: terms.paymentMode, creditLimitPence: terms.creditLimitPence });
    refreshPartnerPages(id);
    return { ok: true, message: "Approved. The applicant has been emailed to sign the agreement and subscribe." };
  } catch (error) {
    return failure(error);
  }
}

/** Change terms of an offered or active partner. Applies to new bookings only. */
export async function updatePartnerTerms(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireAdminUser();
    const terms = termsFrom(formData);
    if (Object.keys(terms.errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors: terms.errors };
    await updatePartner(user.id, id, {
      ...(terms.discountBps !== undefined ? { discountBps: terms.discountBps } : {}),
      paymentMode: terms.paymentMode,
      creditLimitPence: terms.creditLimitPence,
      adminNotes: String(formData.get("adminNotes") ?? "").trim() || null,
    });
    refreshPartnerPages(id);
    return { ok: true, message: "Terms saved. They apply to new bookings only." };
  } catch (error) {
    return failure(error);
  }
}

/** Reject an application, or suspend / re-activate / cancel a partner. The partner is emailed. */
export async function setPartnerStatus(id: string, status: "REJECTED" | "SUSPENDED" | "ACTIVE" | "CANCELLED"): Promise<FormState> {
  try {
    const user = await requireAdminUser();
    await updatePartner(user.id, id, { status });
    refreshPartnerPages(id);
    const done = { REJECTED: "Application rejected.", SUSPENDED: "Partner suspended.", ACTIVE: "Partner re-activated.", CANCELLED: "Partnership cancelled." };
    return { ok: true, message: done[status] };
  } catch (error) {
    return failure(error);
  }
}

/** Per-service discount overrides: blank removes an override (the partner's main discount applies). */
export async function savePartnerServiceDiscounts(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireAdminUser();
    const errors: Record<string, string> = {};
    const rows = formData.getAll("serviceId").map((value) => {
      const serviceId = String(value);
      const bps = percentToBps(formData.get(`discount_${serviceId}`));
      if (Number.isNaN(bps)) errors[`discount_${serviceId}`] = "Enter a percentage.";
      return { serviceId, discountBps: bps === undefined || Number.isNaN(bps) ? null : bps };
    });
    if (Object.keys(errors).length) return { ok: false, message: "Enter percentages as numbers, e.g. 15.", errors };
    await setServiceDiscounts(user.id, id, rows);
    refreshPartnerPages(id);
    return { ok: true, message: "Service discounts saved." };
  } catch (error) {
    return failure(error);
  }
}
