import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { ServiceForm } from "@/features/admin/components/service-form";

export const metadata: Metadata = { title: "Create Service" };

export default function NewServicePage() {
  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title="Create Service" description="Add a service, its pricing tiers and deliverables." />
      <div className="mt-8">
        <ServiceForm />
      </div>
    </div>
  );
}
