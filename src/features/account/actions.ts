"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { fieldErrors, messageFor } from "@/server/http";
import * as account from "@/server/services/account";

/** Profile & Property mutations (Server Actions over src/server/services/account.ts). */

export type AccountFormState = { ok?: boolean; message?: string; errors?: Record<string, string> };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function failure(error: unknown): AccountFormState {
  if (error instanceof z.ZodError) return { ok: false, message: "Please fix the highlighted fields.", errors: fieldErrors(error) };
  if (error instanceof AppError && error.details && typeof error.details === "object") {
    return { ok: false, message: error.message, errors: error.details as Record<string, string> };
  }
  return { ok: false, message: messageFor(error) };
}

export async function updateProfile(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  try {
    const user = await requireUser();
    await account.updateProfile(user, {
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      phone: text(formData, "phone") || null,
    });
    const avatar = formData.get("avatar");
    if (avatar instanceof File && avatar.size > 0) await account.setAvatar(user, avatar);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile updated." };
}

export async function changePassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  try {
    const user = await requireUser();
    await account.changePassword(user, {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });
  } catch (error) {
    return failure(error);
  }
  return { ok: true, message: "Password changed. Other devices have been signed out." };
}

export async function setPushNotifications(enabled: boolean) {
  const user = await requireUser();
  await account.updateProfile(user, { pushNotifications: enabled });
}

export async function savePrimaryProperty(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  try {
    const user = await requireUser();
    const certificate = formData.get("epcCertificate");
    await account.savePrimaryProperty(
      user,
      {
        line1: text(formData, "line1"),
        city: text(formData, "city"),
        postcode: text(formData, "postcode"),
        propertyType: text(formData, "propertyType"),
        epcNumber: text(formData, "epcNumber") || null,
      },
      certificate instanceof File ? certificate : null,
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/dashboard/profile");
  return { ok: true, message: "Property saved. We’ll re-verify the details shortly." };
}
