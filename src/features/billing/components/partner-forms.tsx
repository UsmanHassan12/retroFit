"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { billingAction, partnerAction, type BillingActionState } from "../actions";

const inputClass =
  "h-11 w-full rounded-lg border border-line-soft bg-white px-3 text-sm text-navy focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none";

function Message({ state }: { state: BillingActionState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-brand-700" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

/** Step 1: apply to become a Premium Partner. */
export function PartnerApplyForm() {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(partnerAction, {});
  if (state.ok) return <p className="text-sm text-brand">Thanks! We&apos;ll review your application and email you.</p>;
  return (
    <form action={action} className="grid gap-3 text-left text-navy">
      <input type="hidden" name="intent" value="apply" />
      <input name="companyName" required placeholder="Company name" className={inputClass} aria-label="Company name" />
      <select name="customerType" defaultValue="INSTALLER" className={inputClass} aria-label="Business type">
        <option value="INSTALLER">Installer / contractor</option>
        <option value="MANAGING_AGENT">Managing agent</option>
        <option value="HOUSING_ASSOCIATION">Housing association</option>
        <option value="LOCAL_AUTHORITY">Local authority</option>
        <option value="LANDLORD">Landlord (portfolio)</option>
        <option value="BUSINESS">Other business</option>
      </select>
      <input name="trustmarkLicence" placeholder="TrustMark licence (if any)" className={inputClass} aria-label="TrustMark licence" />
      <input name="vatNumber" placeholder="VAT number (if any)" className={inputClass} aria-label="VAT number" />
      <textarea name="note" rows={2} placeholder="Roughly how many jobs a month?" className={`${inputClass} h-auto py-2`} aria-label="Note" />
      <Message state={state} />
      <Button type="submit" size="lg" fullWidth disabled={pending} className="text-base font-semibold">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Apply to become a partner
      </Button>
    </form>
  );
}

/** Step 3: read and e-sign the agreement (name, date, IP and version are stored). */
export function PartnerSignForm({ version, clauses }: { version: string; clauses: Array<{ title: string; text: string }> }) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(partnerAction, {});
  return (
    <form action={action} className="grid gap-3 text-left">
      <input type="hidden" name="intent" value="sign" />
      <input type="hidden" name="version" value={version} />
      <div className="max-h-64 overflow-y-auto rounded-lg border border-white/20 bg-white/5 p-3 text-xs leading-5">
        <ol className="list-decimal space-y-2 pl-4">
          {clauses.map((clause) => (
            <li key={clause.title}>
              <strong>{clause.title}:</strong> {clause.text}
            </li>
          ))}
        </ol>
        <p className="mt-2 opacity-70">Agreement version {version}. Draft wording pending StepSoft&apos;s solicitor.</p>
      </div>
      <input name="fullName" required placeholder="Type your full name to sign" className={`${inputClass} text-navy`} aria-label="Full name" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="accept" required className="mt-1 accent-brand" />I have read and accept the Premium Partner agreement.
      </label>
      <Message state={state} />
      <Button type="submit" size="lg" fullWidth disabled={pending} className="text-base font-semibold">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Sign agreement
      </Button>
    </form>
  );
}

/** Pay-in-advance partners: add account credit by card. */
export function TopupForm({ minimum }: { minimum: number }) {
  const [amount, setAmount] = useState(String(minimum));
  const [state, action, pending] = useActionState<BillingActionState, FormData>(billingAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="intent" value="topup" />
      <label className="sr-only" htmlFor="topup-amount">
        Amount in pounds
      </label>
      <span className="text-navy">£</span>
      <input id="topup-amount" name="amount" type="number" min={minimum} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} className={`${inputClass} w-32`} />
      <Button type="submit" size="lg" disabled={pending} className="text-sm font-semibold">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Top up
      </Button>
      <div className="basis-full">
        <Message state={state} />
      </div>
    </form>
  );
}
