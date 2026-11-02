"use client";

import { Loader2, Pencil } from "lucide-react";
import Image from "next/image";
import { useActionState, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import { updateProfile, type AccountFormState } from "../actions";

type ProfileFormProps = {
  defaults: { firstName: string; lastName: string; email: string; phone: string; avatar?: string };
};

/** Personal details card. The photo is sent with the form and stored on save. */
export function ProfileForm({ defaults }: ProfileFormProps) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(updateProfile, {});
  const [preview, setPreview] = useState(defaults.avatar);
  const fileInput = useRef<HTMLInputElement>(null);
  const errors = state.errors ?? {};

  return (
    <form id="profile-form" action={action} className="rounded-2xl bg-white p-4 shadow-card sm:p-4">
      <div className="relative mx-auto size-[124px]">
        <span className="relative block size-full overflow-hidden rounded-full border-[6px] border-canvas">
          {preview ? (
            <Image src={preview} alt="Profile photo" fill sizes="124px" className="object-cover" unoptimized={preview.startsWith("blob:")} />
          ) : (
            <Avatar name={`${defaults.firstName} ${defaults.lastName}`} size={112} />
          )}
        </span>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Change profile photo"
          className="absolute right-0 bottom-1 flex size-9 items-center justify-center rounded-full bg-brand text-white shadow-[0_6px_14px_rgb(18_177_78/0.4)]"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
        <input
          ref={fileInput}
          name="avatar"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Upload profile photo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setPreview(URL.createObjectURL(file));
          }}
        />
      </div>

      <div className="mt-6 grid gap-5">
        <Field label="First Name" htmlFor="firstName" error={errors.firstName} labelClassName="text-xs font-normal">
          <Input id="firstName" name="firstName" defaultValue={defaults.firstName} autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} />
        </Field>
        <Field label="Last Name" htmlFor="lastName" error={errors.lastName} labelClassName="text-xs font-normal">
          <Input id="lastName" name="lastName" defaultValue={defaults.lastName} autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} />
        </Field>
        <Field label="Email Address" htmlFor="profileEmail" hint="Contact support to change your sign-in email." labelClassName="text-xs font-normal">
          <Input id="profileEmail" type="email" defaultValue={defaults.email} autoComplete="email" readOnly disabled />
        </Field>
        <Field label="Phone Number" htmlFor="phone" error={errors.phone} labelClassName="text-xs font-normal">
          <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" aria-invalid={Boolean(errors.phone)} />
        </Field>
      </div>

      <Button type="submit" size="lg" fullWidth className="mt-7 text-base font-semibold" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Update
      </Button>
      <p role="status" className={state.message ? `mt-3 text-center text-sm ${state.ok ? "text-brand-700" : "text-danger"}` : "sr-only"}>
        {state.message}
      </p>
    </form>
  );
}
