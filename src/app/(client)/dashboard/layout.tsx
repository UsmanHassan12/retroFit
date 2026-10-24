import type { Metadata } from "next";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { clientNav } from "@/components/dashboard/nav-config";
import { Topbar } from "@/components/dashboard/topbar";
import { getClientProfile } from "@/features/projects/queries";
import { requireSession } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Retrofit Portal" },
  robots: { index: false },
};

export default async function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, profile] = await Promise.all([requireSession("/dashboard"), getClientProfile()]);

  return (
    <DashboardFrame
      nav={clientNav}
      cta={{ label: "New Project", href: "/services" }}
      topbar={
        <Topbar
          user={{ name: session.name, avatar: profile.avatar }}
          searchAction="/dashboard/projects"
          searchPlaceholder="Search your projects..."
          profileHref="/dashboard/profile"
        />
      }
    >
      {children}
    </DashboardFrame>
  );
}
