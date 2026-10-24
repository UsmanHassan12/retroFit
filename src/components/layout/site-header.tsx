"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  /** When the visitor is signed in we swap Login / Get Started for a dashboard link. */
  account?: { name: string; href: string } | null;
};

export function SiteHeader({ account }: SiteHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => !href.includes("#") && pathname.startsWith(href);

  return (
    <header className="border-blueprint sticky top-0 z-40 border-b bg-canvas/85 backdrop-blur-md">
      <div className="border-blueprint mx-auto w-full max-w-[1092px] px-4 py-3 sm:py-4 lg:border-x lg:px-[60px] lg:py-6">
        <nav
          aria-label="Main"
          className="flex h-[60px] items-center justify-between rounded-2xl border border-line-soft bg-white px-4 shadow-soft sm:h-[75px] sm:px-[30px]"
        >
          <Link href="/" aria-label={`${siteConfig.name} home`} className="shrink-0">
            <Logo className="w-[132px] sm:w-[150px]" />
          </Link>

          <ul className="hidden items-center gap-6 md:flex">
            {siteConfig.mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "text-base font-medium transition-colors hover:text-brand",
                    isActive(item.href) ? "text-brand" : "text-ink",
                  )}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3 md:flex">
            {account ? (
              <ButtonLink href={account.href} variant="primary" size="md" className="rounded-[10px]">
                Go to dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="outline" size="md" className="min-w-[118px]">
                  Login
                </ButtonLink>
                <ButtonLink href="/signup" variant="primary" size="md" className="min-w-[118px]">
                  Get Started
                </ButtonLink>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg text-navy md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>

        {open ? (
          <div
            id="mobile-nav"
            // Close the menu whenever a link inside it is followed.
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setOpen(false);
            }}
            className="mt-2 grid gap-1 rounded-2xl border border-line-soft bg-white p-3 shadow-soft md:hidden"
          >
            {siteConfig.mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-ink hover:bg-canvas"
              >
                {item.title}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {account ? (
                <ButtonLink href={account.href} className="col-span-2">
                  Go to dashboard
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink href="/login" variant="outline">
                    Login
                  </ButtonLink>
                  <ButtonLink href="/signup">Get Started</ButtonLink>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
