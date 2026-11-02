"use client";

import { Download, FilePen, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { api, uploadProjectDocument } from "@/lib/api/client";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];

/** Upload / revision / download actions for the Task & Docs tab. */
export function DocumentActions({ projectRef, reportHref }: { projectRef: string; reportHref?: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "revision" | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function upload(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    const invalid = list.find((file) => !ACCEPTED.includes(file.type) || file.size > MAX_BYTES);
    if (invalid) {
      setStatus({ ok: false, text: `${invalid.name}: upload a PDF, JPEG or PNG up to 10MB.` });
      return;
    }
    setBusy("upload");
    setStatus(null);
    try {
      for (const file of list) await uploadProjectDocument(projectRef, file);
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
      await api(`/api/projects/${encodeURIComponent(projectRef)}/messages`, {
        method: "POST",
        json: { body: "Revision requested: please review the latest documents and let me know what needs changing." },
      });
      setStatus({ ok: true, text: "Revision request sent to your coordinator." });
      router.refresh();
    } catch (error) {
      setStatus({ ok: false, text: error instanceof Error ? error.message : "Request failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 rounded-2xl bg-white p-6 shadow-card">
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        aria-label="Choose documents to upload"
        onChange={(event) => upload(event.target.files)}
      />
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
        <span aria-disabled="true" title="Available once your first report is delivered" className={buttonVariants({ variant: "brand", size: "lg", className: "rounded-[10px] opacity-60 shadow-none" })}>
          <Download aria-hidden />
          Download Report
        </span>
      )}
      <p role="status" className={status ? `text-sm ${status.ok ? "text-brand-700" : "text-danger"}` : "sr-only"}>
        {status?.text}
      </p>
    </div>
  );
}
