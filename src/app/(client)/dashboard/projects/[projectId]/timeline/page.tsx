import type { Metadata } from "next";

import { ScrollAnchor } from "@/components/ui/scroll-anchor";

export const metadata: Metadata = { title: "Timeline" };

/** Timeline tab. The panel is rendered (and switched instantly) by the project layout. */
export default function ProjectTimelinePage() {
  return <ScrollAnchor />;
}
