"use client";

import {
  Building2,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  FileSearch,
  Home,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { LogoMark } from "@/components/brand/logo";
import { logout } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

import type { NavIcon, NavItem } from "./nav-config";

const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: Home,
  projects: ClipboardList,
  property: Building2,
  billing: CreditCard,
  services: FileSearch,
  users: Users,
  settings: Settings,
};

type DashboardFrameProps = {
  nav: NavItem[];
  /** Optional primary action pinned to the bottom of the sidebar (client: New Project). */
  cta?: { label: string; href: string };
  /** Server-rendered top-bar content (search, notifications, account). */
  topbar: React.ReactNode;
  children: React.ReactNode;
};

export function DashboardFrame({ nav, cta, topbar, children }: DashboardFrameProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const sidebar = (mobile: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex h-[143px] items-center justify-center border-b border-white/10 px-6">
        <Link href={nav[0]?.href ?? "/"} aria-label="Dashboard home" onClick={() => setMobileOpen(false)}>
          <LogoMark tone="reversed" className={cn("transition-all", collapsed && !mobile ? "w-9" : "w-[54px]")} />
        </Link>
      </div>

      <nav aria-label="Dashboard" className="mt-10 flex-1">
        <ul className="grid gap-3 pr-0">
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  title={collapsed && !mobile ? item.title : undefined}
                  className={cn(
                    "flex h-[47px] items-center gap-3 rounded-r-[14px] px-4 text-[15px] font-medium transition-colors",
                    active
                      ? "border border-l-0 border-brand bg-white text-navy shadow-[0_4px_10px_rgb(0_0_0/0.25)]"
                      : "text-white hover:bg-white/10",
                    collapsed && !mobile && "justify-center px-0",
                  )}
                >
                  <Icon className="size-5 shrink-0" strokeWidth={1.6} aria-hidden />
                  <span className={cn(collapsed && !mobile && "sr-only")}>{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="grid gap-6 px-4 pb-10">
        {cta ? (
          <Link
            href={cta.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex h-[47px] items-center justify-center gap-3 rounded-xl bg-white text-[15px] font-medium text-navy transition-colors hover:bg-brand-50",
              collapsed && !mobile && "px-0",
            )}
          >
            <Plus className="size-4" aria-hidden />
            <span className={cn(collapsed && !mobile && "sr-only")}>{cta.label}</span>
          </Link>
        ) : null}
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-1 py-2 text-[15px] font-medium text-white hover:text-brand-200",
              collapsed && !mobile && "justify-center",
            )}
          >
            <LogOut className="size-5" strokeWidth={1.6} aria-hidden />
            <span className={cn(collapsed && !mobile && "sr-only")}>Logout</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 rounded-r-[30px] bg-navy transition-[width] duration-300 lg:block",
          collapsed ? "w-[92px]" : "w-[250px]",
        )}
      >
        {sidebar(false)}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="absolute top-[50px] -right-4 flex size-8 items-center justify-center rounded-lg bg-white text-navy shadow-[0_4px_8px_rgb(11_28_48/0.25)]"
        >
          <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} aria-hidden />
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            className="absolute inset-0 bg-navy/50 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-[270px] rounded-r-[30px] bg-navy">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              className="absolute top-4 right-4 rounded-md p-1 text-white"
            >
              <X className="size-5" aria-hidden />
            </button>
            {sidebar(true)}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 px-4 pt-4 sm:px-6 lg:px-10 lg:pt-[30px]">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="flex size-10 items-center justify-center rounded-lg bg-white text-navy shadow-soft lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          {topbar}
        </header>
        <main id="main" className="px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-5">
          {children}
        </main>
      </div>
    </div>
  );
}
