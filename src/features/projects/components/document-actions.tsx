"use client";

import { Download, FilePen, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { api, uploadProjectDocument } from "@/lib/api/client";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export type ChecklistItem = { key: string; label: string; required: boolean; uploaded: boolean };

/** Upload / revision / download actions for the Task & Docs tab. */
export function DocumentActions({
  projectRef,
  reportHref,
  checklist = [],
  delivered = false,
}: {
  projectRef: string;
  reportHref?: string;
  /** The service's document list: an upload can be marked as one of these. */
  checklist?: ChecklistItem[];
  /** Delivered projects get a real revision request (included rounds, then quoted). */
  delivered?: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "revision" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const firstMissing = checklist.find((item) => item.required && !item.uploaded)?.key ?? "";
  const [requirementKey, setRequirementKey] = useState(firstMissing);

  async function upload(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const invalid = list.find((file) => !ACCEPTED.includes(file.type) || file.size > MAX_BYTES);
    if (invalid) {
      setStatus({ ok: false, text: `${invalid.name}: upload a PDF, JPG, PNG, DOCX or XLSX up to 25MB.` });
      return;
    }
    setBusy("upload");
    setStatus(null);
    try {
      for (const file of list) await uploadProjectDocument(projectRef, file, requirementKey || undefined);
      setStatus({ ok: true, text: `${list.length} file${list.length > 1 ? "s" : ""} uploaded.` });
      router.refresh();
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function requestRevision() {
    setBusy("revision");
    try {
      if (delivered) {
        const note = window.prompt("What needs changing?");
        if (!note) return;
        await api(`/api/projects/${encodeURIComponent(projectRef)}/revisions`, { method: "POST", json: { note } });
        setStatus({ ok: true, text: "Revision requested. Included rounds start straight away; extra rounds are quoted first." });
      } else {
        await api(`/api/projects/${encodeURIComponent(projectRef)}/messages`, {
          method: "POST",
          json: { body: "Revision requested: please review the latest documents and let me know what needs changing." },
        });
        setStatus({ ok: true, text: "Message sent to your coordinator." });
      }
      router.refresh();
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : "Request failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 rounded-2xl bg-white p-6 shadow-card">
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
        className="sr-only"
        aria-label="Choose documents to upload"
        onChange={(event) => upload(event.target.files)}
      />
      {checklist.length ? (
        <label className="grid min-w-0 gap-1.5 text-sm text-navy">
          <span className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">This upload is</span>
          <select value={requirementKey} onChange={(event) => setRequirementKey(event.target.value)} className="h-11 w-full min-w-0 truncate rounded-lg border border-line-soft bg-white px-3 text-sm">
            <option value="">Something else</option>
            {checklist.map((item) => (
              <option key={item.key} value={item.key}>
                {item.uploaded ? "✓ " : item.required ? "• " : ""}
                {item.label}
                {item.required && !item.uploaded ? " (needed)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button variant="ghost" size="lg" className="rounded-[10px]" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
        {busy === "upload" ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
        {busy === "upload" ? "Uploading…" : "Upload Documents"}
      </Button>
      <Button variant="ghost" size="lg" className="rounded-[10px]" disabled={busy !== null} onClick={requestRevision}>
        {busy === "revision" ? <Loader2 className="animate-spin" aria-hidden /> : <FilePen aria-hidden />}
        Request Revision
      </Button>
      {reportHref ? (
        <a href={reportHref} className={buttonVariants({ variant: "brand", size: "lg", className: "rounded-[10px] shadow-none" })}>
          <Download aria-hidden />
          Download Report
        </a>
      ) : (
        <div className="grid gap-1.5">
          <span
            aria-disabled="true"
            aria-describedby="report-pending"
            className={buttonVariants({ variant: "ghost", size: "lg", className: "rounded-[10px] border-dashed bg-canvas text-faint aria-disabled:opacity-100" })}
          >
            <Download aria-hidden />
            Download Report
          </span>
          <p id="report-pending" className="text-center text-xs text-faint">
            Available once your report is delivered.
          </p>
        </div>
      )}
      <p role="status" className={status ? `text-sm ${status.ok ? "text-brand-700" : "text-danger"}` : "sr-only"}>
        {status?.text}
      </p>
    </div>
  );
}
