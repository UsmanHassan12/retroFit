"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";

import { createSession, deleteSession } from "@/lib/auth/session";
import { homeForRole, type Role } from "@/lib/auth/types";

import { loginSchema, signupSchema, type AuthFormState } from "./schemas";

/** Pull the first message per field out of a zod error. */
function fieldErrors(error: z.ZodError): AuthFormState["fieldErrors"] {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !result[key]) result[key] = issue.message;
  }
  return result;
}

/** Only allow same-site relative redirects after login. */
function safeNext(next: string | undefined, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/**
 * DEMO AUTH — replace with your identity provider / users API.
 * Any email + password signs in. Emails starting with "admin" get the admin console.
 */
function demoRoleFor(email: string): Role {
  return email.startsWith("admin") ? "admin" : "client";
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "there";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: { email: String(formData.get("email") ?? "") } };
  }

  const { email, next } = parsed.data;
  const role = demoRoleFor(email);
  await createSession({ userId: email, email, name: nameFromEmail(email), role });
  redirect(safeNext(next, homeForRole(role)));
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error), values: { email: String(formData.get("email") ?? "") } };
  }

  const { email } = parsed.data;
  await createSession({ userId: email, email, name: nameFromEmail(email), role: "client" });
  redirect("/dashboard");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
