import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { InviteForm } from "@/features/admin/components/invite-form";

export const metadata: Metadata = { title: "Invite New Staff" };

export default function InviteStaffPage() {
  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title="Invite New Staff" />
      <div className="mt-8">
        <InviteForm />
      </div>
    </div>
  );
}
