import { Archive, BadgeCheck, CircleCheck, FileText, GraduationCap, Landmark, Search, Zap } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, IconTile } from "@/components/ui/card";
import type { ServiceAddOn } from "@/features/services/types";
import { formatCurrency } from "@/lib/format";

import type { OrderSelection } from "../lib/order";

export function OrderSummaryCard({ selection }: { selection: OrderSelection }) {
  const { service, tier } = selection;
  return (
    <Card className="grid gap-6 p-4 sm:p-6 md:grid-cols-[289px_1fr]">
      <div className="relative aspect-[289/217] overflow-hidden rounded-xl">
        <Image
          src="/images/services/solar-roof.webp"
          alt=""
          fill
          sizes="(min-width: 768px) 289px, 100vw"
          className="object-cover"
        />
      </div>
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-navy">{service.title}</h2>
          <Badge tone="success" className="px-3 py-2 text-xs">
            {tier.name} Tier
          </Badge>
        </div>
        <p className="mt-4 text-sm leading-[1.5] text-muted">{tier.summary}</p>
        <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {tier.highlights.map((highlight) => (
            <li key={highlight} className="flex items-center gap-2.5 text-sm text-navy">
              <CircleCheck className="size-5 shrink-0 fill-brand text-white" aria-hidden />
              {highlight}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

const ADD_ON_ICONS: Record<ServiceAddOn["icon"], typeof Zap> = {
  express: Zap,
  review: Search,
  filing: Landmark,
  training: GraduationCap,
};

export function SelectedAddOns({ addOns }: { addOns: ServiceAddOn[] }) {
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-navy">Selected Add-ons</h2>
      {addOns.length === 0 ? (
        <p className="mt-5 border-t border-dotted border-line pt-5 text-sm text-muted">
          No add-ons selected. You can add extras from the service page.
        </p>
      ) : (
        <ul className="mt-5">
          {addOns.map((addOn) => {
            const Icon = ADD_ON_ICONS[addOn.icon];
            return (
              <li key={addOn.id} className="flex items-center gap-4 border-t border-dotted border-line py-6 last:pb-2">
                <IconTile>
                  <Icon aria-hidden />
                </IconTile>
                <div className="flex-1">
                  <p className="font-semibold text-navy">{addOn.name}</p>
                  <p className="text-sm text-muted sm:text-base">{addOn.description}</p>
                </div>
                <p className="font-semibold text-navy">{formatCurrency(addOn.price)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const DELIVERABLE_ICONS = { report: FileText, certificate: BadgeCheck, package: Archive } as const;

export function IncludedDeliverables({ selection }: { selection: OrderSelection }) {
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-navy">Included Deliverables</h2>
      <ul className="mt-6 grid gap-6 md:grid-cols-3">
        {selection.service.deliverables.map((deliverable) => {
          const Icon = DELIVERABLE_ICONS[deliverable.icon];
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
