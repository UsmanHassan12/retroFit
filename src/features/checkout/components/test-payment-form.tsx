"use client";

import { CreditCard, FlaskConical, Lock } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import { cancelTestOrder, payTestOrder, type TestPaymentState } from "../actions";

const formatCardNumber = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};

/**
 * Stand-in for Stripe Checkout while payments aren't configured (development, DEMO_MODE or
 * TEST_PAYMENTS). Nothing is charged; a successful test card confirms the order on the server.
 */
export function TestPaymentForm({ reference, amount, backHref, defaultName }: { reference: string; amount: string; backHref: string; defaultName: string }) {
  const [state, formAction, pending] = useActionState<TestPaymentState, FormData>(payTestOrder, {});
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const fields = state.fields ?? {};

  const fillTestCard = () => {
    setCardNumber("4242 4242 4242 4242");
    const next = new Date();
    setExpiry(`12/${String((next.getFullYear() + 2) % 100).padStart(2, "0")}`);
  };

  return (
    <div className="grid gap-6">
      <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-navy">
        <FlaskConical className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div>
          <p className="font-semibold">Test payment: no real card is charged</p>
          <p className="mt-1 text-muted">
            Use <span className="font-mono font-semibold text-navy">4242 4242 4242 4242</span>, any future expiry date and any 3-digit code. Card{" "}
            <span className="font-mono">4000 0000 0000 0002</span> shows a declined payment.{" "}
            <button type="button" onClick={fillTestCard} className="font-semibold text-brand underline-offset-4 hover:underline">
              Fill in the test card
            </button>
          </p>
        </div>
      </div>

      <form action={formAction} className="grid gap-5" noValidate>
        <input type="hidden" name="order" value={reference} />
        <Field label="Name on card" htmlFor="cardName" error={fields.cardName}>
          <Input id="cardName" name="cardName" autoComplete="off" defaultValue={defaultName} aria-invalid={Boolean(fields.cardName)} required />
        </Field>
        <Field label="Card number" htmlFor="cardNumber" error={fields.cardNumber}>
          <div className="relative">
            <Input
              id="cardNumber"
              name="cardNumber"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
              aria-invalid={Boolean(fields.cardNumber)}
              className="pr-11 font-mono"
              required
            />
            <CreditCard className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-faint" aria-hidden />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Expiry (MM/YY)" htmlFor="expiry" error={fields.expiry}>
            <Input
              id="expiry"
              name="expiry"
              inputMode="numeric"
              autoComplete="off"
              placeholder="12/28"
              value={expiry}
              onChange={(event) => setExpiry(formatExpiry(event.target.value))}
              aria-invalid={Boolean(fields.expiry)}
              className="font-mono"
              required
            />
          </Field>
          <Field label="Security code" htmlFor="cvc" error={fields.cvc}>
            <Input id="cvc" name="cvc" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="123" aria-invalid={Boolean(fields.cvc)} className="font-mono" required />
          </Field>
        </div>

        {state.error ? (
          <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="xl" fullWidth disabled={pending}>
          <Lock aria-hidden />
          {pending ? "Processing payment…" : `Pay ${amount}`}
        </Button>
      </form>

      <form action={cancelTestOrder} className="text-center">
        <input type="hidden" name="order" value={reference} />
        <input type="hidden" name="back" value={backHref} />
        <Button type="submit" variant="link" disabled={pending}>
          Cancel and go back
        </Button>
      </form>
    </div>
  );
}
