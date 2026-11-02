import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { InviteForm } from "@/features/admin/components/invite-form";
import { getAdminProjects } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Invite New Staff" };

export default async function InviteStaffPage() {
  await requireAdmin();
  const { projects } = await getAdminProjects({ status: "active", pageSize: "100" });

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title="Invite New Staff" />
      <div className="mt-8">
        <InviteForm
          projects={projects.map((project) => ({
            id: project.id,
            label: `${project.reference} · ${project.property ? `${project.property.line1}, ${project.property.city}` : project.title}`,
          }))}
        />
      </div>
    </div>
  );
}
