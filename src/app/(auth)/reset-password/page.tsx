import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

/** Landing page for the emailed reset link (?token=…). */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = firstParam((await searchParams).token);

  return (
    <AuthShell
      image="/images/auth/eco-campus.webp"
      imageAlt="Energy-efficient office building on a terraced green hillside at dusk"
      title="Choose a new password"
      subtitle="You’ll be signed in as soon as it’s saved"
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-base text-muted">
          This link is incomplete.{" "}
          <Link href="/forgot-password" className="font-semibold text-navy underline underline-offset-4">
            Request a new reset link
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
