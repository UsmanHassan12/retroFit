"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { inviteStaff, type FormState } from "../actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(inviteStaff, {});
  const errors = state.errors ?? {};

  return (
    <form action={action} noValidate>
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email Address" htmlFor="invite-email" error={errors.email} labelClassName="text-xs font-normal">
            <Input id="invite-email" name="email" type="email" placeholder="e.g. jane.doe@stepsoft.co.uk" aria-invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Role" htmlFor="invite-role" error={errors.role} labelClassName="text-xs font-normal">
            <Select id="invite-role" name="role" defaultValue="">
              <option value="" disabled>
                Choose a role
              </option>
              <option value="coordinator">Retrofit Coordinator</option>
              <option value="assessor">Retrofit Assessor</option>
              <option value="designer">Retrofit Designer</option>
              <option value="admin">Administrator</option>
            </Select>
          </Field>
        </div>

        <fieldset className="mt-5 rounded-xl border border-line-soft p-4">
          <legend className="sr-only">Permissions</legend>
          <p className="text-lg font-medium text-navy">Permission</p>
          <div className="mt-3 grid gap-3">
            <div className="flex items-center justify-between text-muted">
              <span id="perm-view-all">View all projects</span>
              <Switch label="View all projects" name="viewAll" defaultChecked />
            </div>
            <div className="flex items-center justify-between text-muted">
              <span>Assign to specific projects</span>
              <Switch label="Assign to specific projects" name="assignSpecific" />
            </div>
          </div>
        </fieldset>
      </div>

      <p role="status" className={state.message ? "mt-4 text-center text-sm text-brand-700" : "sr-only"}>
        {state.message}
      </p>

      <div className="mt-12 flex flex-col justify-center gap-5 sm:flex-row">
        <ButtonLink href="/admin/users" variant="outline" size="lg" className="w-full text-base font-semibold sm:w-[338px]">
          Cancel
        </ButtonLink>
        <Button type="submit" variant="brand" size="lg" disabled={pending} className="w-full text-base font-semibold sm:w-[338px]">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Send Invite
        </Button>
      </div>
    </form>
  );
}
