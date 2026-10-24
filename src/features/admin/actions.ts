"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireStaff } from "@/lib/auth/guards";

/**
 * Admin mutations. Validation is real; persistence is stubbed until the admin API exists.
 * Every action re-checks the staff session — never rely on the UI hiding a button.
 */

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string> };

const tierSchema = z.object({
  name: z.string().trim().min(1, "Tier name is required."),
  price: z.coerce.number().positive("Price must be greater than 0."),
  days: z.coerce.number().int().positive("Enter the number of days."),
  deliverables: z.array(z.string().trim().min(1)).min(1, "Add at least one deliverable."),
});

const serviceSchema = z.object({
  title: z.string().trim().min(3, "Give the service a title (min 3 characters)."),
  description: z.string().trim().min(10, "Describe the service (min 10 characters)."),
  active: z.boolean(),
  tiers: z.array(tierSchema).min(1, "Add at least one pricing tier."),
});

export type ServiceInput = z.input<typeof serviceSchema>;

export async function saveService(input: ServiceInput): Promise<FormState> {
  await requireStaff();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }
  // TODO: POST to the services API.
  redirect("/admin/services");
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  role: z.enum(["coordinator", "assessor", "designer", "admin"], { message: "Choose a role." }),
  viewAll: z.enum(["on", "off"]).default("off"),
  assignSpecific: z.enum(["on", "off"]).default("off"),
});

export async function inviteStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, errors };
  }
  // TODO: create the invitation via the users API and send the email.
  return { ok: true, message: `Invitation sent to ${parsed.data.email}.` };
}

export async function saveEmailTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const template = String(formData.get("template") ?? "");
  if (template.trim().length < 10) return { ok: false, message: "The template looks empty." };
  // TODO: persist the template.
  return { ok: true, message: "Template saved." };
}
