import { ChevronRight, CircleCheck, Circle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PartnerServiceDiscountsForm, PartnerStatusActions, PartnerTermsForm } from "@/features/admin/components/partner-forms";
import { PARTNER_STATUS_LABELS } from "@/features/admin/partner-status";
import { getPartnerDetail } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isAppError } from "@/server/errors";

export const metadata: Metadata = { title: "Partner" };

const pounds = (pence: number) => formatCurrency(pence / 100);

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getPartnerDetail(id).catch((error) => {
    if (isAppError(error) && error.code === "NOT_FOUND") return null;
    throw error;
  });
  if (!data) notFound();
  const { partner, services, limits } = data;
  const status = PARTNER_STATUS_LABELS[partner.status] ?? { text: partner.status, tone: "bg-canvas text-muted" };
  const isApplication = partner.status === "APPLIED";
  const closed = partner.status === "REJECTED" || partner.status === "CANCELLED";
  const activeHolds = partner.holds.filter((hold: { liftedAt?: string | null }) => !hold.liftedAt);

  const steps = [
    { label: "Applied", at: partner.appliedAt },
    { label: "Approved with terms", at: partner.approvedAt },
    { label: "Agreement signed", at: partner.agreement?.signedAt ?? null, detail: partner.agreement ? `${partner.agreement.signedName} · version ${partner.agreement.version}` : null },
    { label: "Subscribed", at: partner.activatedAt },
  ];

  const statusActions = (
    {
      APPLIED: [{ status: "REJECTED", label: "Reject application", confirm: `Reject ${partner.companyName}'s application? They're emailed and can apply again later.`, tone: "danger" }],
      OFFERED: [{ status: "CANCELLED", label: "Withdraw offer", confirm: `Withdraw the offer to ${partner.companyName}? They won't be able to sign or subscribe.`, tone: "danger" }],
      ACTIVE: [
        { status: "SUSPENDED", label: "Suspend", confirm: `Suspend ${partner.companyName}? They lose partner prices and terms on new bookings until re-activated. Their subscription keeps running.`, tone: "danger" },
        { status: "CANCELLED", label: "Cancel partnership", confirm: `Cancel ${partner.companyName}'s partnership now? Their subscription is cancelled and new bookings go back to list prices.`, tone: "danger" },
      ],
      SUSPENDED: [
        { status: "ACTIVE", label: "Re-activate", confirm: `Re-activate ${partner.companyName}? Partner prices and terms apply again to new bookings.`, tone: "brand" },
        { status: "CANCELLED", label: "Cancel partnership", confirm: `Cancel ${partner.companyName}'s partnership? Their subscription is cancelled.`, tone: "danger" },
      ],
    } as Record<string, Array<{ status: "REJECTED" | "SUSPENDED" | "ACTIVE" | "CANCELLED"; label: string; confirm: string; tone: "danger" | "neutral" | "brand" }>>
  )[partner.status] ?? [];

  return (
    <div className="mx-auto max-w-[1120px]">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-3 text-sm">
          <li>
            <Link href="/admin/partners" className="text-muted hover:text-navy">
              Partners
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-4" />
          </li>
          <li aria-current="page" className="font-medium text-navy">
            {partner.companyName}
          </li>
        </ol>
      </nav>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-[34px] leading-tight font-bold text-navy sm:text-[40px]">{partner.companyName}</h1>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", status.tone)}>{status.text}</span>
      </div>
      <p className="mt-2 text-lg text-muted">
        {partner.contact.name} · {partner.contact.email}
        {partner.contact.phone ? ` · ${partner.contact.phone}` : ""}
      </p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          {!closed ? (
            <section aria-labelledby="terms" className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
              <h2 id="terms" className="text-xl font-medium text-navy">
                {isApplication ? "Approve this application" : "Partner terms"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {isApplication
                  ? `Set the terms you're offering. The subscription is ${pounds(limits.subscriptionPence)} + VAT a month.`
                  : partner.status === "OFFERED"
                    ? "Offered and waiting for the partner to sign and subscribe. You can still change the terms."
                    : "What this partner gets on new bookings."}
              </p>
              <div className="mt-5">
                <PartnerTermsForm
                  partnerId={partner.id}
                  mode={isApplication ? "approve" : "edit"}
                  limits={limits}
                  initial={{
                    discountPercent: isApplication ? limits.defaultPercent : partner.discountBps / 100,
                    paymentMode: partner.paymentMode,
                    creditLimit: partner.creditLimitPence === null ? null : partner.creditLimitPence / 100,
                    adminNotes: partner.adminNotes ?? "",
                  }}
                />
              </div>
            </section>
          ) : null}

          <section aria-labelledby="application" className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
            <h2 id="application" className="text-xl font-medium text-navy">
              Application
            </h2>
            <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              {[
                ["Company number", partner.companyNumber],
                ["VAT number", partner.vatNumber],
                ["TrustMark licence", partner.trustmarkLicence],
                ["Applied", formatDate(partner.appliedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">{label}</dt>
                  <dd className={cn("mt-1", value ? "text-navy" : "text-faint")}>{value || "Not given"}</dd>
                </div>
              ))}
            </dl>
            {partner.applicationNote ? (
              <div className="mt-5">
                <p className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">Their note</p>
                <blockquote className="mt-2 rounded-xl bg-canvas px-4 py-3 text-sm whitespace-pre-wrap text-navy">{partner.applicationNote}</blockquote>
              </div>
            ) : null}
            {partner.trustmarkLicence ? null : (
              <p className="mt-5 text-xs text-[#9a6b00]">No TrustMark licence given. Check their certification before approving if they install measures.</p>
            )}
          </section>

          {!isApplication && !closed ? (
            <section aria-labelledby="service-discounts" className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
              <h2 id="service-discounts" className="text-xl font-medium text-navy">
                Discounts per service
              </h2>
              <p className="mt-1 text-sm text-muted">Optional: a different discount on particular services.</p>
              <div className="mt-4">
                <PartnerServiceDiscountsForm
                  partnerId={partner.id}
                  services={services}
                  overrides={Object.fromEntries(partner.serviceDiscounts.map((row: { serviceId: string; discountBps: number }) => [row.serviceId, row.discountBps / 100]))}
                  mainPercent={partner.discountBps / 100}
                  limits={limits}
                />
              </div>
            </section>
          ) : null}
        </div>

        <aside className="grid gap-6">
          <section aria-labelledby="progress" className="rounded-2xl bg-white p-5 shadow-card">
            <h2 id="progress" className="text-base font-semibold text-navy">
              Progress
            </h2>
            <ol className="mt-4 grid gap-3">
              {steps.map((step) => (
                <li key={step.label} className="flex items-start gap-3">
                  {step.at ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden /> : <Circle className="mt-0.5 size-5 shrink-0 text-line" aria-hidden />}
                  <div>
                    <p className={cn("text-sm", step.at ? "text-navy" : "text-faint")}>
                      {step.label}
                      <span className="sr-only">{step.at ? " (done)" : " (not yet)"}</span>
                    </p>
                    {step.at ? <p className="text-xs text-faint">{formatDate(step.at)}</p> : null}
                    {step.detail ? <p className="text-xs text-faint">{step.detail}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
            {partner.subscription.status ? (
              <p className="mt-4 border-t border-dotted border-line pt-3 text-xs text-muted">
                Subscription: <span className="font-medium text-navy">{partner.subscription.status}</span>
                {partner.subscription.renewsAt ? ` · ${partner.subscription.status === "cancelling" ? "ends" : "renews"} ${formatDate(partner.subscription.renewsAt)}` : ""}
              </p>
            ) : null}
          </section>

          {!isApplication ? (
            <section aria-labelledby="account" className="rounded-2xl bg-white p-5 shadow-card">
              <h2 id="account" className="text-base font-semibold text-navy">
                Account
              </h2>
              <dl className="mt-3 grid gap-2 text-sm">
                {(
                  [
                    ["Credit balance", pounds(partner.creditBalancePence)],
                    ["Booked, not yet invoiced", pounds(partner.exposure.unbilledPence)],
                    ["Invoiced, unpaid", pounds(partner.exposure.unpaidPence)],
                    ["Credit limit", partner.creditLimitPence === null ? "None" : pounds(partner.creditLimitPence)],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-medium text-navy tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              {activeHolds.length ? (
                <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
                  On hold: {activeHolds.map((hold: { reason: string }) => hold.reason).join("; ")}
                </p>
              ) : null}
            </section>
          ) : null}

          {statusActions.length ? (
            <section aria-labelledby="status" className="rounded-2xl bg-white p-5 shadow-card">
              <h2 id="status" className="text-base font-semibold text-navy">
                Status
              </h2>
              <p className="mt-1 mb-3 text-xs text-muted">The partner is emailed about any change.</p>
              <PartnerStatusActions partnerId={partner.id} actions={statusActions} />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
