import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { SocialIcon } from "@/components/brand/social-icons";
import { siteConfig } from "@/lib/site";

import { Corner } from "./blueprint";

export function SiteFooter() {
  return (
    <footer className="border-blueprint border-t">
      <div className="border-blueprint relative mx-auto grid w-full max-w-[1092px] sm:grid-cols-2 lg:grid-cols-[372px_repeat(3,1fr)] lg:border-x">
        <Corner className="-top-[3px] -left-[3px] hidden lg:block" />
        <Corner className="-top-[3px] -right-[3px] hidden lg:block" />

        <div className="border-blueprint px-6 py-12 sm:col-span-2 lg:col-span-1 lg:border-r lg:py-[119px]">
          <Link href="/" aria-label={`${siteConfig.name} home`}>
            <Logo className="w-[222px]" />
          </Link>
          <p className="mt-6 max-w-[325px] text-base tracking-[-0.04em] text-subtle">{siteConfig.tagline}</p>
          <ul className="mt-6 flex gap-2" aria-label="Social media">
            {siteConfig.socials.map((social) => (
              <li key={social.name}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.name}
                  className="inline-flex size-7 items-center justify-center rounded-md border border-line-soft bg-white text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  <SocialIcon name={social.name} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {siteConfig.footerNav.map((group, index) => (
          <nav
            key={group.title}
            aria-label={group.title}
            className={
              index < siteConfig.footerNav.length - 1
                ? "border-blueprint px-6 py-8 lg:border-r lg:px-[68px] lg:py-[119px]"
                : "px-6 py-8 lg:px-12 lg:py-[119px]"
            }
          >
            <h2 className="text-base font-semibold tracking-[-0.04em] text-ink">{group.title}</h2>
            <ul className="mt-8 grid gap-[15px]">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-base tracking-[-0.04em] whitespace-nowrap text-subtle transition-colors hover:text-brand"
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-blueprint border-t">
        <p className="border-blueprint mx-auto max-w-[1092px] py-7 text-center text-base tracking-[-0.04em] text-ink lg:border-x">
          {siteConfig.shortName}© {new Date().getFullYear()}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
