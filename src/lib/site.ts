/** Global site configuration — single source of truth for names, links and navigation. */
export const siteConfig = {
  name: "Retrofit Portal",
  shortName: "Retrofit",
  description:
    "Purchase PAS 2035 retrofit services online with transparent pricing, funding support and end-to-end project coordination.",
  // RENDER_EXTERNAL_URL: Render's public address (server-side only; used for metadata and links).
  url: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000",
  tagline: "A centralised digital platform designed to modernise and scale retrofit service delivery.",
  mainNav: [
    { title: "Services", href: "/services" },
    { title: "How it Works", href: "/#how-it-works" },
  ],
  footerNav: [
    {
      title: "Pages",
      links: [
        { title: "Home", href: "/" },
        { title: "How It Works", href: "/#how-it-works" },
        { title: "Services", href: "/services" },
        { title: "Feedback", href: "/#testimonials" },
      ],
    },
    {
      title: "Categories",
      links: [
        { title: "Dashboard", href: "/dashboard" },
        { title: "Service Detail", href: "/services/whole-house-retrofit-assessment" },
      ],
    },
    {
      title: "Resources",
      links: [
        { title: "Privacy Policy", href: "/privacy" },
        { title: "Terms & Conditions", href: "/terms" },
        { title: "Changelog", href: "/changelog" },
      ],
    },
  ],
  socials: [
    { name: "Instagram", href: "https://instagram.com" },
    { name: "X", href: "https://x.com" },
    { name: "LinkedIn", href: "https://linkedin.com" },
    { name: "Facebook", href: "https://facebook.com" },
  ],
} as const;

export type SocialName = (typeof siteConfig.socials)[number]["name"];
