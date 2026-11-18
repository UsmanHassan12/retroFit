import { redirect } from "next/navigation";

/** Checkout moved into the client dashboard. Kept so old links and in-flight Stripe sessions still land. */
export default async function LegacyCheckoutRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
  }
  const qs = query.toString();
  redirect(`/dashboard/checkout/${encodeURIComponent(slug)}/payment${qs ? `?${qs}` : ""}`);
}
