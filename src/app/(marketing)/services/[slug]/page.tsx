import type { Metadata } from "next";

import { ScrollAnchor } from "@/components/ui/scroll-anchor";

import { getServiceBySlug } from "@/features/services/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = await getServiceBySlug((await params).slug);
  if (!service) return {};
  return {
    title: service.headline,
    description: service.intro,
    openGraph: { images: [{ url: service.gallery[0] ?? service.image }] },
  };
}

/** Overview tab (default). The panel itself is rendered (and switched instantly) by the parent layout. */
export default function ServiceOverviewPage() {
  return <ScrollAnchor />;
}
