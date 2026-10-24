import type { Metadata, Viewport } from "next";
import { Exo_2, Inter, Nunito_Sans } from "next/font/google";

import { siteConfig } from "@/lib/site";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const nunito = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["500", "600", "700"],
  display: "swap",
});
const exo = Exo_2({
  subsets: ["latin"],
  variable: "--font-exo",
  weight: ["300", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — PAS 2035 retrofit services, fully compliant & funded`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [{ url: "/images/marketing/hero-home.webp", width: 1921, height: 867 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1c30",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-GB"
      className={`${inter.variable} ${nunito.variable} ${exo.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
