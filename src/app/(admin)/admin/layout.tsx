import type { Metadata } from "next";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { adminNav } from "@/components/dashboard/nav-config";
import { Topbar } from "@/components/dashboard/topbar";
import { requireStaff } from "@/lib/auth/guards";
import { requireUser } from "@/server/auth/session";
import { listNotifications } from "@/server/services/notifications";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Retrofit Admin" },
  robots: { index: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  const notifications = await listNotifications(await requireUser()).catch(() => ({ items: [], unread: 0 }));
  // Services, users and settings are admin-only; other staff see projects.
  const nav = session.role === "admin" ? adminNav : adminNav.filter((item) => item.href === "/admin" || item.href === "/admin/projects");

  return (
    <DashboardFrame
      nav={nav}
      topbar={
        <Topbar
          user={{ name: session.name, avatar: session.avatarUrl ?? undefined }}
          searchAction="/admin/projects"
          searchPlaceholder="Search projects, clients, services..."
          notifications={notifications}
          profileHref={session.role === "admin" ? "/admin/settings" : "/admin"}
        />
      }
    >
      {children}
    </DashboardFrame>
  );
}
