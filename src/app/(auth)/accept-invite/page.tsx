import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInviteForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { firstParam } from "@/lib/utils";
import { peekInvite } from "@/server/services/auth";

export const metadata: Metadata = { title: "Join Retrofit Portal", robots: { index: false } };

/** Landing page for staff invitations (?token=…). */
export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = firstParam((await searchParams).token);
  const invite = token ? await peekInvite(token) : null;
  const role = invite ? invite.role.charAt(0) + invite.role.slice(1).toLowerCase() : null;

  return (
    <AuthShell
      image="/images/auth/green-roof-model.webp"
      imageAlt="Architectural model of a green-roofed apartment building with solar panels"
      title="Join the Retrofit Portal team"
      subtitle={invite ? `You’ve been invited as a ${role} (${invite.email})` : "Staff invitation"}
    >
      {token && invite ? (
        <AcceptInviteForm token={token} />
      ) : (
        <p className="text-base text-muted">
          This invitation is invalid or has expired. Ask an admin to resend it, or{" "}
          <Link href="/login" className="font-semibold text-navy underline underline-offset-4">
            log in
          </Link>
          .
        </p>
      )}
    </AuthShell>
  );
}
