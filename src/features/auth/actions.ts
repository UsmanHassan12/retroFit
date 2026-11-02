"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { homeForRole } from "@/lib/auth/types";
import { AppError } from "@/server/errors";
import { fieldErrors, messageFor } from "@/server/http";
import * as auth from "@/server/services/auth";

import type { AuthFormState } from "./schemas";

/** Only allow same-site relative redirects after login. */
function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** Turn a service error into form state: per-field messages for validation, a banner otherwise. */
function toState(error: unknown, values: AuthFormState["values"]): AuthFormState {
  if (error instanceof z.ZodError) return { fieldErrors: fieldErrors(error), values };
  if (error instanceof AppError && error.details && typeof error.details === "object") {
    return { fieldErrors: error.details as AuthFormState["fieldErrors"], values };
  }
  return { message: messageFor(error), values };
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email");
  let role: string;
  try {
    ({ role } = await auth.login({ email, password: text(formData, "password") }));
  } catch (error) {
    return toState(error, { email });
  }
  redirect(safeNext(formData.get("next"), homeForRole(role)));
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: text(formData, "email"), firstName: text(formData, "firstName"), lastName: text(formData, "lastName") };
  try {
    await auth.register({
      ...values,
      password: text(formData, "password"),
      confirmPassword: text(formData, "confirmPassword"),
    });
  } catch (error) {
    return toState(error, values);
  }
  redirect(safeNext(formData.get("next"), "/dashboard"));
}

export async function logout() {
  await auth.logout();
  redirect("/login");
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email");
  try {
    await auth.forgotPassword({ email });
  } catch (error) {
    return toState(error, { email });
  }
  return { notice: "If an account exists for that email, we’ve sent a link to reset your password. It expires in 1 hour.", values: { email } };
}

export async function resetPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  let role: string;
  try {
    ({ role } = await auth.resetPassword({
      token: text(formData, "token"),
      password: text(formData, "password"),
      confirmPassword: text(formData, "confirmPassword"),
    }));
  } catch (error) {
    return toState(error, {});
  }
  redirect(homeForRole(role));
}

export async function acceptInvite(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { firstName: text(formData, "firstName"), lastName: text(formData, "lastName") };
  let role: string;
  try {
    ({ role } = await auth.acceptInvite({
      ...values,
      token: text(formData, "token"),
      password: text(formData, "password"),
      confirmPassword: text(formData, "confirmPassword"),
    }));
  } catch (error) {
    return toState(error, values);
  }
  redirect(homeForRole(role));
}

/** "Return to admin" from the impersonation banner. */
export async function stopImpersonating() {
  await auth.stopImpersonation();
  redirect("/admin/users");
}
