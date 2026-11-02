import { handle, ok } from "@/server/http";
import { requireService } from "@/server/services/catalog";

export const GET = handle<{ slug: string }>(async (_request, { params }) => {
  const { slug } = await params;
  return ok(await requireService(slug));
});
