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
import { advanceStage, updateProject } from "@/server/services/projects";

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
