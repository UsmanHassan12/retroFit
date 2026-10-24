"use client";

import { Pencil } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

type ProfileFormProps = {
  defaults: { firstName: string; lastName: string; email: string; phone: string; avatar: string };
};

/** Personal details card. Avatar preview is local; persistence goes through the users API. */
export function ProfileForm({ defaults }: ProfileFormProps) {
  const [avatar, setAvatar] = useState(defaults.avatar);
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <form
      className="rounded-2xl bg-white p-4 shadow-card sm:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
    >
      <div className="relative mx-auto size-[124px]">
        <span className="relative block size-full overflow-hidden rounded-full border-[6px] border-canvas">
          <Image src={avatar} alt="Profile photo" fill sizes="124px" className="object-cover" unoptimized={avatar.startsWith("blob:")} />
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
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Upload profile photo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setAvatar(URL.createObjectURL(file));
          }}
        />
      </div>

      <div className="mt-6 grid gap-5">
        <Field label="First Name" htmlFor="firstName" labelClassName="text-xs font-normal">
          <Input id="firstName" name="firstName" defaultValue={defaults.firstName} autoComplete="given-name" />
        </Field>
        <Field label="Last Name" htmlFor="lastName" labelClassName="text-xs font-normal">
          <Input id="lastName" name="lastName" defaultValue={defaults.lastName} autoComplete="family-name" />
        </Field>
        <Field label="Email Address" htmlFor="profileEmail" labelClassName="text-xs font-normal">
          <Input id="profileEmail" name="email" type="email" defaultValue={defaults.email} autoComplete="email" />
        </Field>
        <Field label="Phone Number" htmlFor="phone" labelClassName="text-xs font-normal">
          <Input id="phone" name="phone" type="tel" defaultValue={defaults.phone} autoComplete="tel" />
        </Field>
      </div>

      <Button type="submit" size="lg" fullWidth className="mt-7 text-base font-semibold">
        Update
      </Button>
      <p role="status" className={saved ? "mt-3 text-center text-sm text-brand-700" : "sr-only"}>
        {saved ? "Profile updated." : ""}
      </p>
    </form>
  );
}
