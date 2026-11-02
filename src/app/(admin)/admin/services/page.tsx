import { ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { setServiceActive } from "@/features/admin/actions";
import { getAdminServices } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { formatPrice, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Services Management" };

export default async function AdminServicesPage() {
  await requireAdmin();
  const services = await getAdminServices();

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
              <TH>Orders</TH>
              <TH>Service Status</TH>
            </tr>
          </THead>
          <TBody>
            {services.map((service) => (
              <TR key={service.id}>
                <TD>
                  <Link href={`/services/${service.slug}`} className="inline-flex items-center gap-1.5 hover:text-brand" target="_blank">
                    {service.title}
                    <ExternalLink className="size-3.5 text-faint" aria-label="(opens storefront page)" />
                  </Link>
                </TD>
                <TD>{formatPrice(service.fromPricePence / 100)}</TD>
                <TD>{Math.min(...service.tiers.map((tier: { deliveryDays: number }) => tier.deliveryDays))}</TD>
                <TD>{formatRelative(service.updatedAt)}</TD>
                <TD>{service.deliverableCount}</TD>
                <TD>{service.orders}</TD>
                <TD>
                  <form action={setServiceActive.bind(null, service.id, !service.active)}>
                    <button
                      type="submit"
                      title={service.active ? "Click to hide from the storefront" : "Click to publish"}
                      className={service.active ? "text-brand hover:underline" : "text-faint hover:underline"}
                    >
                      {service.active ? "Active" : "Inactive"}
                    </button>
                  </form>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
