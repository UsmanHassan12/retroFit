import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = firstParam((await searchParams).next);

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
