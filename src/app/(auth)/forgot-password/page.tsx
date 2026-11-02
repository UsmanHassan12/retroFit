import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/features/auth/components/auth-forms";
import { AuthShell } from "@/features/auth/components/auth-shell";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      image="/images/auth/eco-campus.webp"
      imageAlt="Energy-efficient office building on a terraced green hillside at dusk"
      title="Reset your password"
      subtitle="We’ll email you a secure link to choose a new password"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
