"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

import { applyDiscountCode, placeOrder, slotsForPostcode, type PlaceOrderState } from "../actions";
import { IntakeFields, type IntakeQuestion } from "./intake-fields";

type Totals = { listPence: number; discountPence: number; addonsPence: number; netPence: number; vatPence: number; totalPence: number };
type Slot = { id: string; date: string; window: "AM" | "PM"; label: string };
type Property = { id: string; label: string; postcode: string };

type ReceiptCardProps = {
  slug: string;
  qty: string;
  addons: string;
  tier: "BASIC" | "PARTNER";
  totals: Totals;
  discountSource: string;
  vatPercent: number;
  paymentMethods: string[];
  requiresProperty: boolean;
  needsVisit: boolean;
  properties: Property[];
  slots: Slot[];
  orderQuestions: IntakeQuestion[];
  lineQuestions: IntakeQuestion[];
  facts: Record<string, unknown>;
  notice?: string;
};

const money = (pence: number) => formatCurrency(pence / 100);
const METHOD_LABELS: Record<string, { title: string; hint: string }> = {
  CARD: { title: "Card", hint: "Pay in full now with Stripe." },
  CREDIT: { title: "Account credit", hint: "Taken from your prepaid balance." },
  CREDIT_AND_CARD: { title: "Credit + card", hint: "Use your credit and pay any difference by card." },
  WEEKLY_INVOICE: { title: "Weekly invoice", hint: "Added to this week's invoice (Friday 17:00 cut-off)." },
};
const inputClass =
  "h-11 w-full rounded-lg border border-line-soft bg-white px-3 text-sm text-navy focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none";

export function ReceiptCard(props: ReceiptCardProps) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; totals: Totals } | null>(null);
  const [checking, setChecking] = useState(false);
  const [codeMessage, setCodeMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [propertyId, setPropertyId] = useState(props.properties[0]?.id ?? "new");
  const [slots, setSlots] = useState<Slot[]>(props.slots);
  const [state, formAction, pending] = useActionState<PlaceOrderState, FormData>(placeOrder, {});

  const totals = applied?.totals ?? props.totals;
  const partner = props.tier === "PARTNER";
  const discountLabel = applied ? `Discount (${applied.code})` : props.discountSource === "PARTNER" ? "Partner discount" : "Discount";

  async function applyCode() {
    const value = code.trim().toUpperCase();
    if (!value || checking) return;
    setChecking(true);
    try {
      const result = await applyDiscountCode({ slug: props.slug, qty: props.qty, addons: props.addons, code: value });
      if (!result) {
        setApplied(null);
        setCodeMessage({ ok: false, text: "That code isn’t valid or has expired." });
      } else if (!result.applied) {
        setApplied(null);
        setCodeMessage({ ok: false, text: "Your partner discount is already the better deal (discounts don’t stack)." });
      } else {
        setApplied({ code: result.code, totals: result.totals });
        setCodeMessage({ ok: true, text: `Code ${result.code} applied.` });
      }
    } catch {
      setCodeMessage({ ok: false, text: "We couldn’t check that code. Please try again." });
    } finally {
      setChecking(false);
    }
  }

  async function changeProperty(id: string) {
    setPropertyId(id);
    const property = props.properties.find((item) => item.id === id);
    if (props.needsVisit && property) setSlots(await slotsForPostcode(property.postcode));
  }

  return (
    <section aria-labelledby="receipt-title" className="mx-auto w-full max-w-[758px] overflow-hidden rounded-2xl bg-white shadow-[0_4px_12px_rgb(11_28_48/0.3)]">
      <h2 id="receipt-title" className="border-b-[3px] border-brand bg-navy py-6 text-center text-base font-semibold text-white">
        Receipt
      </h2>

      <form action={formAction} className="px-5 pt-6 pb-8 sm:px-[25px]">
        <input type="hidden" name="slug" value={props.slug} />
        <input type="hidden" name="qty" value={props.qty} />
        <input type="hidden" name="addons" value={props.addons} />
        {applied ? <input type="hidden" name="discountCode" value={applied.code} /> : null}

        {props.notice ? (
          <p role="status" className="mb-6 rounded-lg bg-warning-soft px-4 py-3 text-sm text-[#7a5500]">
            {props.notice}
          </p>
        ) : null}

        {props.requiresProperty ? (
          <fieldset className="grid gap-3">
            <legend className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">Property</legend>
            <select name="propertyId" value={propertyId} onChange={(event) => changeProperty(event.target.value)} className={inputClass} aria-label="Property">
              {props.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
              <option value="new">A new address…</option>
            </select>
            {propertyId === "new" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="property.line1" placeholder="Address line 1" required className={inputClass} aria-label="Address line 1" />
                <input name="property.city" placeholder="Town or city" required className={inputClass} aria-label="Town or city" />
                <input name="property.postcode" placeholder="Postcode" required className={inputClass} aria-label="Postcode" onBlur={async (event) => props.needsVisit && setSlots(await slotsForPostcode(event.target.value))} />
                <select name="property.propertyType" defaultValue="house" className={inputClass} aria-label="Property type">
                  {["house", "flat", "bungalow", "maisonette", "park home"].map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {props.needsVisit ? (
          <fieldset className="mt-6 grid gap-2">
            <legend className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">Site visit</legend>
            {slots.length ? (
              <select name="availabilityId" defaultValue="" className={inputClass} aria-label="Visit slot">
                <option value="">Choose a date later</option>
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {slot.window} ({slot.label})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-muted">No online slots for this area yet. Your coordinator will arrange the visit.</p>
            )}
          </fieldset>
        ) : null}

        <div className="mt-6">
          <IntakeFields
            facts={props.facts}
            groups={[
              { prefix: "order", title: "Funding, installer and measures", questions: props.orderQuestions },
              { prefix: "line", title: "About this job", questions: props.lineQuestions },
            ]}
          />
          <p className="mt-3 text-xs text-muted">You can upload the documents we need from your project page after booking.</p>
        </div>

        <div className="my-6 border-t border-dotted border-line" />

        <dl className="grid gap-5 text-base">
          <Row label="List price" value={money(totals.listPence)} />
          {totals.discountPence > 0 ? <Row label={discountLabel} value={`−${money(totals.discountPence)}`} accent /> : null}
          {totals.addonsPence > 0 ? <Row label="Add-ons" value={money(totals.addonsPence)} /> : null}
          <Row label={`VAT (${props.vatPercent}%)`} value={money(totals.vatPence)} />
        </dl>

        {!partner ? (
          <>
            <div className="my-6 border-t border-dotted border-line" />
            <label htmlFor="discount-code" className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">
              Discount code
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="discount-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyCode();
                  }
                }}
                placeholder="RETRO2026"
                aria-describedby="discount-message"
                className="h-[49px] flex-1 rounded-lg border border-line-soft px-4 text-sm uppercase shadow-[0_2px_4px_rgb(11_28_48/0.12)] placeholder:text-line focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none"
              />
              <Button variant="brand" className="h-[49px] w-[117px] rounded-lg shadow-none" onClick={applyCode} disabled={checking}>
                {checking ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Apply
              </Button>
            </div>
            <p id="discount-message" role="status" className={codeMessage ? (codeMessage.ok ? "mt-2 text-xs text-brand-700" : "mt-2 text-xs text-danger") : "sr-only"}>
              {codeMessage?.text}
            </p>
          </>
        ) : null}

        <div className="my-6 border-t border-dotted border-line" />
        <div className="flex items-center justify-between">
          <p className="font-semibold text-navy">Total Amount</p>
          <p className="text-3xl font-semibold tracking-tight text-navy">{money(totals.totalPence)}</p>
        </div>

        {props.paymentMethods.length > 1 ? (
          <fieldset className="mt-6 grid gap-2">
            <legend className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">Pay with</legend>
            {props.paymentMethods.map((method, index) => (
              <label key={method} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-soft p-3 text-sm has-[:checked]:border-brand">
                <input type="radio" name="method" value={method} defaultChecked={index === 0} className="mt-0.5 accent-brand" />
                <span>
                  <span className="font-semibold text-navy">{METHOD_LABELS[method]?.title ?? method}</span>
                  <span className="block text-xs text-muted">{METHOD_LABELS[method]?.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <input type="hidden" name="method" value={props.paymentMethods[0] ?? "CARD"} />
        )}

        <div className="mt-6 grid gap-2 text-sm text-navy">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="acceptTerms" required className="mt-1 accent-brand" />
            <span>
              I accept the{" "}
              <Link href="/terms" className="underline">
                terms of service
              </Link>
              .
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="gdprConsent" className="mt-1 accent-brand" />
            <span>I have the occupant&apos;s consent for their details to be processed (UK GDPR).</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="shareDataConsent" className="mt-1 accent-brand" />
            <span>StepSoft may share project data with the funder and TrustMark as needed for compliance.</span>
          </label>
        </div>

        {state.error ? (
          <p role="alert" className="mt-6 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="xl" fullWidth className="mt-10 text-sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Processing…" : "Complete Purchase"}
        </Button>
        <p className="mt-6 text-center text-xs text-muted">Card payments are processed securely by Stripe. A VAT receipt or invoice is issued for every booking.</p>
      </form>
    </section>
  );
}

function Row({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={accent ? "font-semibold text-brand-700" : "font-semibold text-navy"}>{value}</dd>
    </div>
  );
}
