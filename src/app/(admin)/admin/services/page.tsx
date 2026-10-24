import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ADMIN_SERVICES } from "@/features/admin/data";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Services Management" };

export default function AdminServicesPage() {
  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Services Management"
        description="Add and edit services, pricing tiers and add-ons."
        actions={
          <ButtonLink href="/admin/services/new" size="lg" className="text-sm">
            <Plus aria-hidden />
            Create Service
          </ButtonLink>
        }
      />
      <div className="mt-8">
        <Table>
          <THead>
            <tr>
              <TH>Service Title</TH>
              <TH>From Price</TH>
              <TH>Working Days</TH>
              <TH>Last Updated</TH>
              <TH>Deliverables</TH>
              <TH>Service Status</TH>
            </tr>
          </THead>
          <TBody>
            {ADMIN_SERVICES.map((service) => (
              <TR key={service.id}>
                <TD>{service.title}</TD>
                <TD>{formatPrice(service.price)}</TD>
                <TD>{service.days}</TD>
                <TD>{service.updated}</TD>
                <TD>{service.deliverables}</TD>
                <TD className={service.active ? "text-brand" : "text-faint"}>{service.active ? "Active" : "Inactive"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
