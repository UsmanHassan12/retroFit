import { notFound } from "@/server/errors";
import { handle } from "@/server/http";
import { readObject } from "@/server/integrations/storage";
import { MEDIA_PREFIX } from "@/server/services/media";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Public images: service photos (admin uploads) and profile avatars. */
export const GET = handle<{ key: string[] }>(async (_request, { params }) => {
  const { key } = await params;
  const path = key.join("/");
  if (!/^(services|avatars)\/[\w-]+\.(jpg|jpeg|png|webp)$/.test(path)) throw notFound();
  const object = await readObject(`${MEDIA_PREFIX}${path}`);
  if (!object) throw notFound("Image");
  return new Response(object.body, {
    headers: {
      "Content-Type": object.contentType ?? TYPES[path.split(".").pop()!] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
