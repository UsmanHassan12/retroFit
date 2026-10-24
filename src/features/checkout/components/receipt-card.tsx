"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

import { placeOrder, type PlaceOrderState } from "../actions";
import { calculateTotals, discountRateFor } from "../lib/pricing";

type ReceiptCardProps = {
  slug: string;
  tierId: string;
  tierName: string;
  tierPrice: number;
  addOnIds: string[];
  addOnPrices: number[];
};

export function ReceiptCard({ slug, tierId, tierName, tierPrice, addOnIds, addOnPrices }: ReceiptCardProps) {
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeMessage, setCodeMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [state, formAction, pending] = useActionState<PlaceOrderState, FormData>(placeOrder, {});

  const rate = discountRateFor(appliedCode);
  // Mirrors the server calculation for display; the server action recomputes before charging.
  const totals = calculateTotals({ base: tierPrice, addOns: addOnPrices }, rate);

  function applyCode() {
    const value = code.trim().toUpperCase();
    if (!value) return;
    if (discountRateFor(value) > 0) {
      setAppliedCode(value);
      setCodeMessage({ ok: true, text: `Code ${value} applied — ${Math.round(discountRateFor(value) * 100)}% off.` });
    } else {
      setAppliedCode(null);
      setCodeMessage({ ok: false, text: "That code isn’t valid." });
    }
  }

  return (
    <section
      aria-labelledby="receipt-title"
      className="mx-auto w-full max-w-[758px] overflow-hidden rounded-2xl bg-white shadow-[0_4px_12px_rgb(11_28_48/0.3)]"
    >
      <h2 id="receipt-title" className="border-b-[3px] border-brand bg-navy py-6 text-center text-base font-semibold text-white">
        Receipt
      </h2>

      <form action={formAction} className="px-5 pt-6 pb-8 sm:px-[25px]">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="tier" value={tierId} />
        <input type="hidden" name="addons" value={addOnIds.join(",")} />
        {appliedCode ? <input type="hidden" name="discountCode" value={appliedCode} /> : null}

        <dl className="grid gap-5 text-base">
          <Row label={`Base Price (${tierName})`} value={formatCurrency(totals.base)} />
          <Row label="Selected Add-ons" value={formatCurrency(totals.addOns)} />
          {totals.discount > 0 ? <Row label={`Discount (${appliedCode})`} value={`−${formatCurrency(totals.discount)}`} accent /> : null}
          <Row label="VAT (20%)" value={formatCurrency(totals.vat)} />
        </dl>

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
          <Button variant="brand" className="h-[49px] w-[117px] rounded-lg shadow-none" onClick={applyCode}>
            Apply
          </Button>
        </div>
        <p
          id="discount-message"
          role="status"
          className={codeMessage ? (codeMessage.ok ? "mt-2 text-xs text-brand-700" : "mt-2 text-xs text-danger") : "sr-only"}
        >
          {codeMessage?.text}
        </p>

        <div className="my-6 border-t border-dotted border-line" />
        <div className="flex items-center justify-between">
          <p className="font-semibold text-navy">Total Amount</p>
          <p className="text-3xl font-semibold tracking-tight text-navy">{formatCurrency(totals.total)}</p>
        </div>
        <div className="mt-6 border-t border-dotted border-line" />

        {state.error ? (
          <p role="alert" className="mt-6 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="xl" fullWidth className="mt-12 text-sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Processing…" : "Complete Purchase"}
        </Button>
        <p className="mt-6 text-center text-xs text-muted">Secure payment by Stripe or PayPal. A VAT invoice is emailed on purchase.</p>
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
