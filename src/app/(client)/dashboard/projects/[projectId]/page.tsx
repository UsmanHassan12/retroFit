import type { Metadata } from "next";

import { ScrollAnchor } from "@/components/ui/scroll-anchor";

export const metadata: Metadata = { title: "Overview" };

/** Overview tab. The panel is rendered (and switched instantly) by the project layout. */
export default function ProjectOverviewPage() {
  return <ScrollAnchor />;
}
