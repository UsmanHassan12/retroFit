import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { getSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/types";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({
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
      image="/images/auth/eco-campus.webp"
      imageAlt="Energy-efficient office building on a terraced green hillside at dusk"
      title="Login to your account"
      subtitle="The faster you login, the faster we get to work"
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
