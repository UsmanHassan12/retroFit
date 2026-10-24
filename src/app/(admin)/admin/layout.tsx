import type { Metadata } from "next";

import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { adminNav } from "@/components/dashboard/nav-config";
import { Topbar } from "@/components/dashboard/topbar";
import { requireStaff } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Retrofit Admin" },
  robots: { index: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();

  return (
    <DashboardFrame
      nav={adminNav}
      topbar={
        <Topbar
          user={{ name: session.name, avatar: "/images/avatars/sarah.webp" }}
          searchAction="/admin/projects"
          searchPlaceholder="Search projects, clients, services..."
          profileHref="/admin/settings"
        />
      }
    >
      {children}
    </DashboardFrame>
  );
}
