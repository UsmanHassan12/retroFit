import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { UploadDropzone } from "@/components/ui/upload-dropzone";
import { ProfileForm } from "@/features/account/components/profile-form";
import { getClientProfile } from "@/features/projects/queries";

export const metadata: Metadata = { title: "Profile & Settings" };

export default async function ProfilePage() {
  const profile = await getClientProfile();

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Profile & Settings"
        description="Manage your personal identity, property portfolio, and security preferences."
      />

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_473px]">
        <ProfileForm defaults={profile} />

        <div className="grid gap-6">
          <section aria-labelledby="security" className="rounded-2xl bg-white p-4 shadow-card">
            <h2 id="security" className="text-xl font-medium text-navy">
              Password &amp; Security
            </h2>
            <p className="mt-4 max-w-sm text-sm text-muted">
              Change your password or manage two-factor authentication to keep your account secure.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-line-soft p-4 shadow-card">
              <div>
                <p className="font-medium text-navy">Account Password</p>
                <p className="text-sm text-faint">Last changed 3 months ago</p>
              </div>
              <button type="button" className="text-xs font-semibold tracking-[0.05em] text-brand uppercase hover:underline">
                Update
              </button>
            </div>
          </section>

          <section aria-labelledby="notifications" className="rounded-2xl bg-white p-4 shadow-card">
            <h2 id="notifications" className="text-xl font-medium text-navy">
              Notification Preferences
            </h2>
            <div className="mt-6 flex items-start justify-between gap-6">
              <div>
                <p className="font-medium text-navy">Receive Push Notifications</p>
                <p className="mt-1 text-sm text-faint">Receive alerts when your retrofit project hits a major milestone.</p>
              </div>
              <Switch label="Receive push notifications" defaultChecked />
            </div>
          </section>
        </div>
      </div>

      <form aria-labelledby="property" className="mt-6 rounded-2xl bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 id="property" className="text-xl font-medium text-navy">
            Primary Property Details
          </h2>
          {profile.property.verified ? (
            <Badge tone="success" className="px-4 py-2.5 text-xs">
              Verified
            </Badge>
          ) : null}
        </div>
        <div className="mt-6 grid gap-5">
          <Field label="Address" htmlFor="address" labelClassName="text-xs font-normal">
            <Input id="address" name="address" defaultValue={profile.property.address} autoComplete="street-address" />
          </Field>
          <Field label="Property Type" htmlFor="propertyType" labelClassName="text-xs font-normal">
            <Input id="propertyType" name="propertyType" defaultValue={profile.property.type} />
          </Field>
          <Field label="EPC Number" htmlFor="epc" labelClassName="text-xs font-normal">
            <Input id="epc" name="epc" defaultValue={profile.property.epcNumber} inputMode="numeric" />
          </Field>
          <UploadDropzone title="Upload New EPC Certificate" name="epcCertificate" />
        </div>
        <Button type="submit" size="lg" fullWidth className="mt-8 text-base font-semibold">
          Upload
        </Button>
      </form>

      <div className="mt-10 flex justify-center">
        <Button variant="brand" size="lg" className="w-full max-w-[336px] text-base font-semibold">
          Save
        </Button>
      </div>
    </div>
  );
}
