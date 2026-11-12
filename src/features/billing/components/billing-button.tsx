"use client";

import { Loader2 } from "lucide-react";
import { useActionState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";

import { billingAction, type BillingActionState } from "../actions";

type ButtonProps = ComponentProps<typeof Button>;

/** A button that posts a billing intent and redirects to Stripe (or shows why it can't). */
export function BillingButton({
  intent,
  fields,
  children,
  ...props
}: { intent: "subscribe" | "portal" | "cancel" | "topup" | "pay"; fields?: Record<string, string> } & Omit<ButtonProps, "type">) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(billingAction, {});
  return (
    <form action={action} className="contents">
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" disabled={pending || props.disabled} {...props}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </Button>
      {state.message ? (
        <p role={state.ok ? "status" : "alert"} className={`basis-full text-sm ${state.ok ? "text-brand-700" : "text-danger"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
