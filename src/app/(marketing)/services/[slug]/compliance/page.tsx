import type { Metadata } from "next";

import { ScrollAnchor } from "@/components/ui/scroll-anchor";

import { getServiceBySlug } from "@/features/services/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = await getServiceBySlug((await params).slug);
  return service ? { title: `Compliance — ${service.title}`, description: service.intro } : {};
}

/** Compliance tab. The panel itself is rendered (and switched instantly) by the parent layout. */
export default function ServiceCompliancePage() {
  return <ScrollAnchor />;
}
