"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { PasswordInput } from "@/features/auth/components/password-input";

import { changePassword, setPushNotifications, type AccountFormState } from "../actions";

/** "Account Password → Update" expands into the change-password form. */
export function PasswordCard() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AccountFormState, FormData>(changePassword, {});
  const errors = state.errors ?? {};

  return (
    <div className="mt-4 rounded-xl border border-line-soft p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-navy">Account Password</p>
          <p className="text-sm text-faint">Use a strong password you don’t use elsewhere.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="change-password"
          className="text-xs font-semibold tracking-[0.05em] text-brand uppercase hover:underline"
        >
          {open ? "Cancel" : "Update"}
        </button>
      </div>
      {open ? (
        <form id="change-password" action={action} noValidate className="mt-4 grid gap-4">
          <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword} labelClassName="text-xs font-normal">
            <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" className="h-12 text-sm" />
          </Field>
          <Field label="New password" htmlFor="newPassword" error={errors.password} hint="At least 8 characters, including a letter and a number." labelClassName="text-xs font-normal">
            <PasswordInput id="newPassword" name="password" autoComplete="new-password" className="h-12 text-sm" />
          </Field>
          <Field label="Confirm new password" htmlFor="confirmNewPassword" error={errors.confirmPassword} labelClassName="text-xs font-normal">
            <PasswordInput id="confirmNewPassword" name="confirmPassword" autoComplete="new-password" className="h-12 text-sm" />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Change password
          </Button>
        </form>
      ) : null}
      <p role="status" className={state.message ? `mt-3 text-sm ${state.ok ? "text-brand-700" : "text-danger"}` : "sr-only"}>
        {state.message}
      </p>
    </div>
  );
}

export function PushNotificationsSwitch({ defaultChecked }: { defaultChecked: boolean }) {
  const [, startTransition] = useTransition();
  return (
    <Switch
      label="Receive push notifications"
      defaultChecked={defaultChecked}
      onCheckedChange={(checked) => startTransition(() => setPushNotifications(checked))}
    />
  );
}
