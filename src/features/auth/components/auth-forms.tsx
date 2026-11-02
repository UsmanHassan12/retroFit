"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

import { acceptInvite, login, requestPasswordReset, resetPassword, signup } from "../actions";
import type { AuthFormState } from "../schemas";

import { PasswordInput } from "./password-input";

const bigInput = "h-[60px] text-base";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(login, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="grid gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />

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

    </form>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signup, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="grid gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={errors.firstName} labelClassName="text-base">
          <Input id="firstName" name="firstName" autoComplete="given-name" placeholder="John" defaultValue={state.values?.firstName} className={bigInput} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName} labelClassName="text-base">
          <Input id="lastName" name="lastName" autoComplete="family-name" placeholder="Smith" defaultValue={state.values?.lastName} className={bigInput} />
        </Field>
      </div>
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

/** Error banner or success notice for an auth form. */
function FormMessage({ state }: { state: AuthFormState }) {
  if (state.message) {
    return (
      <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
        {state.message}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
        {state.notice}
      </p>
    );
  }
  return null;
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="grid gap-5">
      <FormMessage state={state} />
      <Field label="Email address" htmlFor="email" error={errors.email} labelClassName="text-base">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="John.smith@gmail.com"
          defaultValue={state.values?.email}
          aria-invalid={Boolean(errors.email)}
          className={bigInput}
          required
        />
      </Field>
      <Button type="submit" variant="dark" size="xl" fullWidth disabled={pending} className="mt-6 text-lg font-medium">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Send reset link
      </Button>
      <Link href="/login" className="mt-4 text-base font-semibold text-navy underline underline-offset-4 hover:text-brand">
        Back to login
      </Link>
    </form>
  );
}

/** New password + confirmation, shared by reset and invite acceptance. */
function NewPasswordFields({ errors }: { errors: NonNullable<AuthFormState["fieldErrors"]> }) {
  return (
    <>
      <Field
        label="New password"
        htmlFor="password"
        error={errors.password}
        hint="At least 8 characters, including a letter and a number."
        labelClassName="text-base"
      >
        <PasswordInput id="password" name="password" autoComplete="new-password" placeholder="Enter password" aria-invalid={Boolean(errors.password)} required />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword} labelClassName="text-base">
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          placeholder="Enter confirm password"
          aria-invalid={Boolean(errors.confirmPassword)}
          required
        />
      </Field>
    </>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resetPassword, {});
  return (
    <form action={action} noValidate className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <NewPasswordFields errors={state.fieldErrors ?? {}} />
      <Button type="submit" variant="dark" size="xl" fullWidth disabled={pending} className="mt-6 text-lg font-medium">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Set new password
      </Button>
    </form>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(acceptInvite, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" error={errors.firstName} labelClassName="text-base">
          <Input id="firstName" name="firstName" autoComplete="given-name" defaultValue={state.values?.firstName} className={bigInput} required />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName} labelClassName="text-base">
          <Input id="lastName" name="lastName" autoComplete="family-name" defaultValue={state.values?.lastName} className={bigInput} required />
        </Field>
      </div>
      <NewPasswordFields errors={errors} />
      <Button type="submit" variant="dark" size="xl" fullWidth disabled={pending} className="mt-6 text-lg font-medium">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Join the team
      </Button>
    </form>
  );
}
