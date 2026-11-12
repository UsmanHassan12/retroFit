import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PARTNER_STATUS_LABELS } from "@/features/admin/partner-status";
import { getPartners } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn, firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Partners" };

const VIEWS = [
  { id: "new", label: "New applications", statuses: ["APPLIED"] },
  { id: "offered", label: "Awaiting signature", statuses: ["OFFERED"] },
  { id: "active", label: "Active", statuses: ["ACTIVE"] },
  { id: "closed", label: "Suspended & closed", statuses: ["SUSPENDED", "CANCELLED", "REJECTED"] },
  { id: "all", label: "All", statuses: [] },
] as const;

export default async function PartnersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const params = await searchParams;
  const q = firstParam(params.q);
  const { partners: everyone, counts } = await getPartners({ q });
  // Open on new applications when there are any, otherwise on active partners.
  const requested = VIEWS.find((view) => view.id === firstParam(params.view));
  const view = requested ?? (counts.APPLIED ? VIEWS[0] : VIEWS[2]);
  const partners = view.statuses.length ? everyone.filter((partner) => (view.statuses as readonly string[]).includes(partner.status)) : everyone;
  const countFor = (statuses: readonly string[]) => (statuses.length ? statuses.reduce((sum, status) => sum + (counts[status] ?? 0), 0) : everyone.length);
  const href = (id: string) => `/admin/partners?view=${id}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader title="Premium Partners" description="Review applications, set partner terms and manage active partners." />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter partners" className="flex flex-wrap gap-2">
          {VIEWS.map((item) => {
            const count = countFor(item.statuses);
            const urgent = item.id === "new" && count > 0;
            return (
              <Link
                key={item.id}
                href={href(item.id)}
                aria-current={item.id === view.id ? "page" : undefined}
                className={cn(
                  "inline-flex h-[38px] items-center gap-2 rounded-full border px-5 text-sm transition-colors",
                  item.id === view.id ? "border-brand bg-brand text-white" : "border-line-soft bg-white text-navy hover:border-brand/40",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    item.id === view.id ? "bg-white/20 text-white" : urgent ? "bg-danger text-white" : "bg-canvas text-muted",
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>
        <form action="/admin/partners" role="search">
          <input type="hidden" name="view" value={view.id} />
          <label htmlFor="partner-search" className="sr-only">
            Search partners
          </label>
          <input
            id="partner-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search company or email…"
            className="h-[38px] w-64 rounded-full border border-line-soft bg-white px-4 text-sm text-navy placeholder:text-faint focus-visible:border-brand focus-visible:outline-none"
          />
        </form>
      </div>

      <div className="mt-6">
        <Table>
          <THead>
            <tr>
              <TH>Company</TH>
              <TH>Status</TH>
              <TH>Discount</TH>
              <TH>Payment</TH>
              <TH>{view.id === "new" ? "Applied" : "Since"}</TH>
              <TH>
                <span className="sr-only">Action</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {partners.length === 0 ? (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-muted">
                  {view.id === "new" ? "No applications waiting. New ones appear here and admins are emailed." : q ? `No partners match “${q}”.` : "Nothing here yet."}
                </TD>
              </TR>
            ) : null}
            {partners.map((partner) => {
              const status = PARTNER_STATUS_LABELS[partner.status] ?? { text: partner.status, tone: "bg-canvas text-muted" };
              const applied = partner.status === "APPLIED";
              return (
                <TR key={partner.id}>
                  <TD>
                    <p className="font-medium">{partner.companyName}</p>
                    <p className="text-xs text-muted">
                      {partner.contact.name} · {partner.contact.email}
                    </p>
                  </TD>
                  <TD>
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap", status.tone)}>{status.text}</span>
                  </TD>
                  <TD className="tabular-nums">{applied ? <span className="text-faint">Not set</span> : `${partner.discountBps / 100}%`}</TD>
                  <TD>
                    {applied ? (
                      <span className="text-faint">Not set</span>
                    ) : partner.paymentMode === "WEEKLY" ? (
                      <>
                        Weekly invoice
                        {partner.creditLimitPence !== null ? <span className="block text-xs text-muted">limit {formatCurrency(partner.creditLimitPence / 100)}</span> : null}
                      </>
                    ) : (
                      "Pay in advance"
                    )}
                  </TD>
                  <TD className="whitespace-nowrap">{formatDate(partner.activatedAt ?? partner.approvedAt ?? partner.appliedAt)}</TD>
                  <TD className="text-right">
                    <Link
                      href={`/admin/partners/${partner.id}`}
                      className={cn(
                        "inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium whitespace-nowrap",
                        applied ? "bg-brand text-white hover:bg-brand-600" : "border border-line bg-white text-navy hover:bg-canvas",
                      )}
                    >
                      {applied ? "Review" : "Manage"}
                    </Link>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
