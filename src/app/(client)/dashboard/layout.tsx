import type { Metadata } from "next";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { clientNav } from "@/components/dashboard/nav-config";
import { Topbar } from "@/components/dashboard/topbar";
import { ImpersonationBanner } from "@/components/dashboard/impersonation-banner";
import { requireSession } from "@/lib/auth/guards";
import { requireUser } from "@/server/auth/session";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Retrofit Portal" },
  robots: { index: false },
};

export default async function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("/dashboard");
  const notifications = await listNotifications(await requireUser()).catch(() => ({ items: [], unread: 0 }));

  return (
    <DashboardFrame
      nav={clientNav}
      cta={{ label: "New Project", href: "/services" }}
      topbar={
        <Topbar
          user={{ name: session.name, avatar: session.avatarUrl ?? undefined }}
          searchAction="/dashboard/projects"
          searchPlaceholder="Search your projects..."
          notifications={notifications}
          profileHref="/dashboard/profile"
        />
      }
    >
      {session.impersonating ? <ImpersonationBanner name={session.name} /> : null}
      {children}
    </DashboardFrame>
  );
}
