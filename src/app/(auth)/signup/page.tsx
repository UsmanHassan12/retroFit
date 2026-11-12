import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignupForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { getSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/types";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = firstParam((await searchParams).next);

  // Already signed in (checked against the database, not just the cookie): skip the form.
  const session = await getSession();
  if (session) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : homeForRole(session.role));

  return (
    <AuthShell
      image="/images/auth/green-roof-model.webp"
      imageAlt="Architectural model of a green-roofed apartment building with solar panels"
      title="Sign up to your account"
      subtitle="Sign up to start your retrofit services"
    >
      <SignupForm next={next} />
    </AuthShell>
  );
}
