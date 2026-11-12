import { Archive, BadgeCheck, CircleCheck, Clock, FileText, Landmark, Search, Zap } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, IconTile } from "@/components/ui/card";
import type { Service } from "@/features/services/types";
import { formatCurrency, formatDate } from "@/lib/format";

import type { CheckoutQuote } from "../queries";

const money = (pence: number) => formatCurrency(pence / 100);

export function OrderSummaryCard({ service, quote }: { service: Service; quote: CheckoutQuote }) {
  const line = quote.lines[0]!;
  const partner = quote.tier === "PARTNER";
  return (
    <Card className="grid gap-6 p-4 sm:p-6 md:grid-cols-[289px_1fr]">
      <div className="relative aspect-[289/217] overflow-hidden rounded-xl">
        <Image src={service.image} alt="" fill sizes="(min-width: 768px) 289px, 100vw" className="object-cover" />
      </div>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-navy">{service.title}</h2>
          <Badge tone="success" className="px-3 py-2 text-xs">
            {partner ? "Premium Partner" : "Basic"}
          </Badge>
        </div>
        <p className="mt-4 text-sm leading-[1.5] text-muted">{service.summary}</p>
        <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <li className="flex items-center gap-2.5 text-sm text-navy">
            <CircleCheck className="size-5 shrink-0 fill-brand text-white" aria-hidden />
            {line.quantity} × {service.pricing.unitLabel} at {money(line.unitPricePence)}
          </li>
          <li className="flex items-center gap-2.5 text-sm text-navy">
            <Clock className="size-5 shrink-0 text-brand" aria-hidden />
            {line.fastTrack ? (service.fastTrackTurnaround ?? service.turnaround) : service.turnaround}
          </li>
          {line.estimatedDueAt ? (
            <li className="flex items-center gap-2.5 text-sm text-navy">
              <CircleCheck className="size-5 shrink-0 fill-brand text-white" aria-hidden />
              Due around {formatDate(line.estimatedDueAt)} once we have everything
            </li>
          ) : null}
          <li className="flex items-center gap-2.5 text-sm text-navy">
            <CircleCheck className="size-5 shrink-0 fill-brand text-white" aria-hidden />
            {service.pricing.revisionRounds} revision round{service.pricing.revisionRounds === 1 ? "" : "s"} included
          </li>
        </ul>
      </div>
    </Card>
  );
}

const ADD_ON_ICONS = { express: Zap, "extra-visit": Search, travel: Landmark } as Record<string, typeof Zap>;

export function SelectedAddOns({ quote, service }: { quote: CheckoutQuote; service: Service }) {
  const addons = quote.lines[0]?.addons ?? [];
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-navy">Selected Add-ons</h2>
      {addons.length === 0 ? (
        <p className="mt-5 border-t border-dotted border-line pt-5 text-sm text-muted">No add-ons selected. You can add extras from the service page.</p>
      ) : (
        <ul className="mt-5">
          {addons.map((addon) => {
            const Icon = ADD_ON_ICONS[addon.key] ?? Zap;
            const info = service.addOns.find((item) => item.id === addon.key);
            return (
              <li key={addon.key} className="flex items-center gap-4 border-t border-dotted border-line py-6 last:pb-2">
                <IconTile>
                  <Icon aria-hidden />
                </IconTile>
                <div className="flex-1">
                  <p className="font-semibold text-navy">
                    {addon.name}
                    {addon.quantity > 1 ? ` × ${addon.quantity}` : ""}
                  </p>
                  {info ? <p className="text-sm text-muted sm:text-base">{info.description}</p> : null}
                </div>
                <p className="font-semibold text-navy">{money(addon.totalPence)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const DELIVERABLE_ICONS = { report: FileText, certificate: BadgeCheck, package: Archive } as const;

export function IncludedDeliverables({ service }: { service: Service }) {
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-navy">Included Deliverables</h2>
      <ul className="mt-6 grid gap-6 md:grid-cols-3">
        {service.deliverables.map((deliverable) => {
          const Icon = DELIVERABLE_ICONS[deliverable.icon] ?? FileText;
          return (
            <li key={deliverable.title} className="rounded-xl border border-line-soft p-4 shadow-soft">
              <IconTile className="size-10">
                <Icon aria-hidden />
              </IconTile>
              <p className="mt-6 font-semibold text-navy">{deliverable.title}</p>
              <p className="mt-2 text-xs leading-[1.5] text-muted">{deliverable.description}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
