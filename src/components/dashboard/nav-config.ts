/** Serializable navigation config (icons are resolved inside the client sidebar). */
export type NavIcon = "dashboard" | "projects" | "property" | "billing" | "services" | "users" | "partners" | "settings";

export type NavItem = { title: string; href: string; icon: NavIcon; exact?: boolean };

export const clientNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: "dashboard", exact: true },
  { title: "My Projects", href: "/dashboard/projects", icon: "projects" },
  { title: "Profile & Property", href: "/dashboard/profile", icon: "property" },
  { title: "Billing", href: "/dashboard/billing", icon: "billing" },
];

export const adminNav: NavItem[] = [
  { title: "Dashboard", href: "/admin", icon: "dashboard", exact: true },
  { title: "Projects", href: "/admin/projects", icon: "projects" },
  { title: "Services", href: "/admin/services", icon: "services" },
  { title: "Users", href: "/admin/users", icon: "users" },
  { title: "Partners", href: "/admin/partners", icon: "partners" },
  { title: "Settings", href: "/admin/settings", icon: "settings" },
];
