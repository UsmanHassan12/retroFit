import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/features/account/components/profile-form";
import { PropertyForm } from "@/features/account/components/property-form";
import { PasswordCard, PushNotificationsSwitch } from "@/features/account/components/security-panels";
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
              Changing your password signs you out on every other device.
            </p>
            <PasswordCard />
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
              <PushNotificationsSwitch defaultChecked={profile.pushNotifications} />
            </div>
          </section>
        </div>
      </div>

      <PropertyForm property={profile.property} />

      <div className="mt-10 flex justify-center">
        <Button type="submit" form="profile-form" variant="brand" size="lg" className="w-full max-w-[336px] text-base font-semibold">
          Save
        </Button>
      </div>
    </div>
  );
}
