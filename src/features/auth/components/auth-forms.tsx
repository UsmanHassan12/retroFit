"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import { login, signup } from "../actions";
import type { AuthFormState } from "../schemas";

import { PasswordInput } from "./password-input";

const bigInput = "h-[60px] text-base";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="grid gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field label="Email address" htmlFor="email" error={errors.email} labelClassName="text-base">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="John.smith@gmail.com"
          defaultValue={state.values?.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={bigInput}
          required
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password} labelClassName="text-base">
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          required
        />
      </Field>

      <Link href="/forgot-password" className="-mt-1 w-fit text-sm font-medium text-muted italic hover:text-navy">
        Forgot password?
      </Link>

      <Button type="submit" variant="dark" size="xl" fullWidth disabled={pending} className="mt-8 text-lg font-medium">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Login
      </Button>

      <p className="mt-8 text-base tracking-[-0.03em] text-navy">
        Don’t have an account?{" "}
        <Link href="/signup" className="font-semibold underline underline-offset-4 hover:text-brand">
          Sign up
        </Link>
      </p>

      <p className="rounded-lg bg-brand-50 px-4 py-3 text-xs text-brand-700">
        Demo: any email and password signs in. Use an email starting with <strong>admin</strong> to open
        the admin console.
      </p>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="grid gap-5">
      <Field label="Email address" htmlFor="email" error={errors.email} labelClassName="text-base">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="John.smith@gmail.com"
          defaultValue={state.values?.email}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={bigInput}
          required
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={errors.password}
        hint="At least 8 characters, including a letter and a number."
        labelClassName="text-base"
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          placeholder="Enter password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? "password-error" : undefined}
          required
        />
      </Field>

      <Field label="Confirm Password" htmlFor="confirmPassword" error={errors.confirmPassword} labelClassName="text-base">
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Enter confirm password"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          required
        />
      </Field>

      <Button type="submit" variant="dark" size="xl" fullWidth disabled={pending} className="mt-8 text-lg font-medium">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Create account
      </Button>

      <p className="mt-6 text-base tracking-[-0.03em] text-navy">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold underline underline-offset-4 hover:text-brand">
          Log in
        </Link>
      </p>
    </form>
  );
}
