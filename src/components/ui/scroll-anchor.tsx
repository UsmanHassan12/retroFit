/**
 * Tab pages whose panels are rendered by their layout (UrlTabs) render only this marker.
 *
 * Why: after a <Link> navigation, Next.js scrolls to the first DOM element of the new route
 * segment. A page that returns `null` has no element, so Next.js searched onwards and ended up
 * scrolling to the footer. The layout renders this page's output at the very top, so the
 * browser lands at the top of the page instead. 1px high because Next.js skips elements with
 * an empty bounding box.
 */
export function ScrollAnchor() {
  return <div aria-hidden className="pointer-events-none h-px w-full" />;
}
