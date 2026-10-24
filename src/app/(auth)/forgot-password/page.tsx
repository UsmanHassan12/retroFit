import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata: Metadata = { title: "Reset your password" };

/** UI only — wire the form to the password-reset endpoint when the auth API is ready. */
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      image="/images/auth/eco-campus.webp"
      imageAlt="Energy-efficient office building on a terraced green hillside at dusk"
      title="Reset your password"
      subtitle="We’ll email you a secure link to choose a new password"
    >
      <form className="grid gap-5">
        <Field label="Email address" htmlFor="email" labelClassName="text-base">
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="John.smith@gmail.com" className="h-[60px] text-base" required />
        </Field>
        <Button type="submit" variant="dark" size="xl" fullWidth className="mt-6 text-lg font-medium">
          Send reset link
        </Button>
        <Link href="/login" className="mt-4 text-base font-semibold text-navy underline underline-offset-4 hover:text-brand">
          Back to login
        </Link>
      </form>
    </AuthShell>
  );
}
