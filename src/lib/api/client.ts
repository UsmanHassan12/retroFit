/**
 * Tiny browser-side fetch wrapper for the JSON API (src/app/api). Errors follow the API's
 * `{ error: { code, message, details } }` shape and are thrown as ApiError.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: { Accept: "application/json", ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error ?? {};
    throw new ApiError(response.status, error.code ?? "INTERNAL", error.message ?? "Something went wrong.", error.details);
  }
  return body as T;
}

/** Upload one project document: request a presigned URL, PUT the bytes, confirm. */
export async function uploadProjectDocument(projectRef: string, file: File, requirementKey?: string) {
  const base = `/api/projects/${encodeURIComponent(projectRef)}/documents`;
  const { document, upload } = await api<{
    document: { id: string };
    upload: { url: string; method: "PUT"; headers: Record<string, string> };
  }>(base, { method: "POST", json: { fileName: file.name, mimeType: file.type, sizeBytes: file.size, ...(requirementKey ? { requirementKey } : {}) } });

  const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file });
  if (!put.ok) throw new ApiError(put.status, "UPLOAD_FAILED", `Upload of ${file.name} failed. Please try again.`);

  return api<{ id: string; fileName: string; version: number }>(`${base}/${document.id}/confirm`, { method: "POST" });
}
