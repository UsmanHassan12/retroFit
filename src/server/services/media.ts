import "server-only";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { createUploadUrl } from "../integrations/storage";

/**
 * Public media (service images). Uploaded with a presigned URL like documents, then served
 * through /api/media/<key> so the bucket itself can stay private.
 */

export const MEDIA_PREFIX = "media/";

export const mediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"], { message: "Upload a JPEG, PNG or WebP image." }),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024, "Images must be 10MB or smaller."),
});

export async function requestMediaUpload(input: z.input<typeof mediaUploadSchema>) {
  const data = mediaUploadSchema.parse(input);
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[data.mimeType];
  const key = `${MEDIA_PREFIX}services/${randomUUID()}.${extension}`;
  return { key, publicUrl: `/api/media/${key.slice(MEDIA_PREFIX.length)}`, upload: await createUploadUrl(key, data.mimeType) };
}
