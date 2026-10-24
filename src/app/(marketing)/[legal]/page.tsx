import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlueprintSection } from "@/components/layout/blueprint";

/** Placeholder legal pages until the client supplies final copy. */
const PAGES = {
  privacy: {
    title: "Privacy Policy",
    body: "We process personal data in line with UK GDPR and the Data Protection Act 2018. The final policy will be published here before launch.",
  },
  terms: {
    title: "Terms & Conditions",
    body: "These terms govern the purchase of retrofit services through the Retrofit Portal. Final terms will be published here before launch.",
  },
  changelog: {
    title: "Changelog",
    body: "Release notes for the Retrofit Portal will appear here.",
  },
} as const;

type Slug = keyof typeof PAGES;

export function generateStaticParams() {
  return Object.keys(PAGES).map((legal) => ({ legal }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ legal: string }> }): Promise<Metadata> {
  const { legal } = await params;
  const page = PAGES[legal as Slug];
  return page ? { title: page.title } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  const page = PAGES[legal as Slug];
  if (!page) notFound();

  return (
    <BlueprintSection innerClassName="px-6 py-20">
      <article className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl font-bold text-navy">{page.title}</h1>
        <p className="mt-6 text-lg text-muted">{page.body}</p>
      </article>
    </BlueprintSection>
  );
}
