"use client";

import { Loader2 } from "lucide-react";
import { useActionState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";

import { billingAction, type BillingActionState } from "../actions";

type ButtonProps = ComponentProps<typeof Button>;

/** A button that posts a billing intent and redirects to Stripe (or shows why it can't). */
export function BillingButton({ intent, children, ...props }: { intent: "subscribe" | "portal" } & Omit<ButtonProps, "type">) {
  const [state, action, pending] = useActionState<BillingActionState, FormData>(billingAction, {});
  return (
    <form action={action} className="contents">
      <input type="hidden" name="intent" value={intent} />
      <Button type="submit" disabled={pending || props.disabled} {...props}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </Button>
      {state.message ? (
        <p role="alert" className="basis-full text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
