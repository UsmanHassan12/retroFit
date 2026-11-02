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
import { updateProject } from "@/server/services/projects";

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
  title: string;
  description: string;
  active: boolean;
  imageUrl?: string;
  tiers: { name: string; price: string; days: string; deliverables: string[] }[];
};

/** "Add New Service" form → catalogue. Prices arrive in pounds and are stored in pence. */
export async function saveService(input: ServiceFormInput): Promise<FormState> {
  try {
    const user = await requireAdminUser();
    await createService(user.id, {
      title: input.title,
      summary: input.description,
      active: input.active,
      ...(input.imageUrl ? { imageUrl: input.imageUrl, gallery: [input.imageUrl] } : {}),
      tiers: input.tiers.map((tier) => ({
        name: tier.name,
        pricePence: Math.round(Number(tier.price) * 100) || 0,
        deliveryDays: Math.round(Number(tier.days)) || 0,
        deliverables: tier.deliverables,
      })),
    });
  } catch (error) {
    const state = failure(error);
    // Map server field names back to the form's (pricePence → price, deliveryDays → days, summary → description).
    if (state.errors) {
      state.errors = Object.fromEntries(
        Object.entries(state.errors).map(([key, value]) => [
          key.replace(/\.pricePence$/, ".price").replace(/\.deliveryDays$/, ".days").replace(/^summary$/, "description"),
          value,
        ]),
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
    await updateProject(user, reference, {
      phase: value("phase") as never,
      status: value("status") as never,
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
