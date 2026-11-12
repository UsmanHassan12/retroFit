"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { approvePartner, savePartnerServiceDiscounts, setPartnerStatus, updatePartnerTerms, type FormState } from "../actions";

/** Admin forms on the partner detail page: terms (approve / edit), status changes, per-service discounts. */

const field = "h-11 w-full rounded-[10px] border border-line-soft bg-white px-3 text-sm text-navy focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 aria-invalid:border-danger";

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-brand-700" : "text-danger")}>
      {state.message}
    </p>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-error`} className="text-xs font-medium text-danger">
      {error}
    </p>
  ) : null;
}

type Limits = { minPercent: number; maxPercent: number; defaultPercent: number; defaultCreditLimit: number | null };

export function PartnerTermsForm({
  partnerId,
  mode,
  initial,
  limits,
}: {
  partnerId: string;
  mode: "approve" | "edit";
  initial: { discountPercent: number; paymentMode: "ADVANCE" | "WEEKLY"; creditLimit: number | null; adminNotes: string };
  limits: Limits;
}) {
  const action = (mode === "approve" ? approvePartner : updatePartnerTerms).bind(null, partnerId);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [paymentMode, setPaymentMode] = useState(initial.paymentMode);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <div className="grid content-start gap-2">
          <label htmlFor="discount" className="text-sm font-medium text-navy">
            Partner discount (%)
          </label>
          <input
            id="discount"
            name="discount"
            inputMode="decimal"
            defaultValue={initial.discountPercent}
            aria-invalid={Boolean(errors.discount || errors.discountBps) || undefined}
            aria-describedby="discount-hint"
            className={cn(field, "tabular-nums")}
          />
          <p id="discount-hint" className="text-xs text-faint">
            Off list prices, {limits.minPercent}–{limits.maxPercent}%.
          </p>
          <FieldError id="discount" error={errors.discount ?? errors.discountBps} />
        </div>
        <fieldset className="grid content-start gap-2">
          <legend className="text-sm font-medium text-navy">How they pay</legend>
          {(
            [
              ["WEEKLY", "Weekly invoice", "Booked work is invoiced every Friday."],
              ["ADVANCE", "Pay in advance", "Each booking is taken from prepaid credit."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-line-soft bg-white px-3 py-2.5 has-checked:border-brand has-checked:bg-brand-100/40">
              <input type="radio" name="paymentMode" value={value} checked={paymentMode === value} onChange={() => setPaymentMode(value)} className="mt-0.5 accent-brand" />
              <span>
                <span className="block text-sm text-navy">{label}</span>
                <span className="block text-xs text-faint">{hint}</span>
              </span>
            </label>
          ))}
          <FieldError id="paymentMode" error={errors.paymentMode} />
        </fieldset>
        <div className="grid content-start gap-2">
          <label htmlFor="creditLimit" className="text-sm font-medium text-navy">
            Credit limit (£)
          </label>
          <input
            id="creditLimit"
            name="creditLimit"
            inputMode="decimal"
            disabled={paymentMode === "ADVANCE"}
            defaultValue={initial.creditLimit ?? (mode === "approve" ? (limits.defaultCreditLimit ?? "") : "")}
            placeholder={paymentMode === "ADVANCE" ? "Not used" : "No limit"}
            aria-invalid={Boolean(errors.creditLimit || errors.creditLimitPence) || undefined}
            aria-describedby="creditLimit-hint"
            className={cn(field, "tabular-nums disabled:bg-canvas disabled:text-faint")}
          />
          <p id="creditLimit-hint" className="text-xs text-faint">
            {paymentMode === "ADVANCE" ? "Advance partners pay before work starts." : "Unpaid plus unbilled work. Leave blank for no limit."}
          </p>
          <FieldError id="creditLimit" error={errors.creditLimit ?? errors.creditLimitPence} />
        </div>
      </div>

      {mode === "edit" ? (
        <div className="grid gap-2">
          <label htmlFor="adminNotes" className="text-sm font-medium text-navy">
            Internal notes <span className="font-normal text-faint">(staff only)</span>
          </label>
          <textarea id="adminNotes" name="adminNotes" rows={3} maxLength={2000} defaultValue={initial.adminNotes} className={cn(field, "h-auto py-2.5")} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant={mode === "approve" ? "brand" : "dark"} size="md" disabled={pending} className="shadow-none">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {mode === "approve" ? "Approve & send offer" : "Save terms"}
        </Button>
        <Message state={state} />
      </div>
      {mode === "approve" ? (
        <p className="text-xs text-faint">The applicant is emailed to sign the partner agreement online and start the subscription. Partner prices start once they’ve subscribed.</p>
      ) : (
        <p className="text-xs text-faint">Changes apply to new bookings only. Orders already placed keep their prices.</p>
      )}
    </form>
  );
}

type StatusAction = { status: "REJECTED" | "SUSPENDED" | "ACTIVE" | "CANCELLED"; label: string; confirm: string; tone: "danger" | "neutral" | "brand" };

/** Two-step buttons: the first click explains what happens, the second does it. */
export function PartnerStatusActions({ partnerId, actions }: { partnerId: string; actions: StatusAction[] }) {
  const [armed, setArmed] = useState<StatusAction | null>(null);
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();

  if (!actions.length) return null;
  return (
    <div className="grid gap-3">
      {armed ? (
        <div role="alertdialog" aria-labelledby="status-confirm" className="grid gap-3 rounded-xl border border-line-soft bg-canvas p-4">
          <p id="status-confirm" className="text-sm text-navy">
            {armed.confirm}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={armed.tone === "danger" ? "dark" : "brand"}
              className={cn("shadow-none", armed.tone === "danger" && "bg-danger hover:bg-danger/90")}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setState(await setPartnerStatus(partnerId, armed.status));
                  setArmed(null);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {armed.label}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setArmed(null)}>
              Keep as is
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.status}
              size="sm"
              variant="ghost"
              className={cn(action.tone === "danger" && "text-danger hover:bg-danger/5", action.tone === "brand" && "text-brand-700")}
              onClick={() => {
                setState({});
                setArmed(action);
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
      <Message state={state} />
    </div>
  );
}

export function PartnerServiceDiscountsForm({
  partnerId,
  services,
  overrides,
  mainPercent,
  limits,
}: {
  partnerId: string;
  services: Array<{ id: string; code: string; title: string; active: boolean }>;
  overrides: Record<string, number>;
  mainPercent: number;
  limits: Limits;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(savePartnerServiceDiscounts.bind(null, partnerId), {});
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-dotted border-line text-muted">
              <th scope="col" className="py-2 pr-4 font-medium">
                Service
              </th>
              <th scope="col" className="w-40 py-2 font-medium">
                Discount (%)
              </th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => {
              const name = `discount_${service.id}`;
              return (
                <tr key={service.id} className="border-b border-dotted border-line last:border-0">
                  <td className="py-2 pr-4">
                    <input type="hidden" name="serviceId" value={service.id} />
                    <label htmlFor={name} className="text-navy">
                      <span className="mr-2 font-mono text-xs text-faint">{service.code}</span>
                      {service.title}
                      {!service.active ? <span className="ml-2 text-xs text-faint">(hidden)</span> : null}
                    </label>
                  </td>
                  <td className="py-2">
                    <input
                      id={name}
                      name={name}
                      inputMode="decimal"
                      defaultValue={overrides[service.id] ?? ""}
                      placeholder={`${mainPercent} (main)`}
                      aria-invalid={Boolean(errors[name]) || undefined}
                      className={cn(field, "h-9 tabular-nums")}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-faint">
        Leave blank to use the partner’s main discount ({mainPercent}%). Each override must be {limits.minPercent}–{limits.maxPercent}%.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="dark" size="md" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save service discounts
        </Button>
        <Message state={state} />
      </div>
    </form>
  );
}
