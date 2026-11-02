"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { UploadDropzone } from "@/components/ui/upload-dropzone";

import { savePrimaryProperty, type AccountFormState } from "../actions";

type PropertyDefaults = {
  line1: string;
  city: string;
  postcode: string;
  type: string;
  epcNumber: string;
  verified: boolean;
} | null;

/** Primary property + EPC certificate upload. */
export function PropertyForm({ property }: { property: PropertyDefaults }) {
  const [state, action, pending] = useActionState<AccountFormState, FormData>(savePrimaryProperty, {});
  const errors = state.errors ?? {};

  return (
    <form action={action} aria-labelledby="property" className="mt-6 rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h2 id="property" className="text-xl font-medium text-navy">
          Primary Property Details
        </h2>
        {property?.verified ? (
          <Badge tone="success" className="px-4 py-2.5 text-xs">
            Verified
          </Badge>
        ) : property ? (
          <Badge tone="warning" className="px-4 py-2.5 text-xs">Pending verification</Badge>
        ) : null}
      </div>
      <div className="mt-6 grid gap-5">
        <Field label="Address" htmlFor="line1" error={errors.line1} labelClassName="text-xs font-normal">
          <Input id="line1" name="line1" defaultValue={property?.line1} autoComplete="address-line1" aria-invalid={Boolean(errors.line1)} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Town / City" htmlFor="city" error={errors.city} labelClassName="text-xs font-normal">
            <Input id="city" name="city" defaultValue={property?.city} autoComplete="address-level2" aria-invalid={Boolean(errors.city)} />
          </Field>
          <Field label="Postcode" htmlFor="postcode" error={errors.postcode} labelClassName="text-xs font-normal">
            <Input id="postcode" name="postcode" defaultValue={property?.postcode} autoComplete="postal-code" aria-invalid={Boolean(errors.postcode)} />
          </Field>
        </div>
        <Field label="Property Type" htmlFor="propertyType" error={errors.propertyType} labelClassName="text-xs font-normal">
          <Input id="propertyType" name="propertyType" defaultValue={property?.type} placeholder="e.g. Mid Terrace Flat" aria-invalid={Boolean(errors.propertyType)} />
        </Field>
        <Field label="EPC Number" htmlFor="epcNumber" error={errors.epcNumber} labelClassName="text-xs font-normal">
          <Input id="epcNumber" name="epcNumber" defaultValue={property?.epcNumber} inputMode="numeric" aria-invalid={Boolean(errors.epcNumber)} />
        </Field>
        <UploadDropzone title="Upload New EPC Certificate" name="epcCertificate" />
      </div>
      {state.message ? (
        <p role="status" className={`mt-4 text-sm ${state.ok ? "text-brand-700" : "text-danger"}`}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" size="lg" fullWidth className="mt-8 text-base font-semibold" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Upload
      </Button>
    </form>
  );
}
