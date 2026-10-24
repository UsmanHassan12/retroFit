"use client";

import { Download, FilePen, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/** Upload / revision / download actions for the Task & Docs tab (UI only until the files API exists). */
export function DocumentActions() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="grid gap-4 rounded-2xl bg-white p-6 shadow-card">
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        aria-label="Choose documents to upload"
        onChange={(event) => {
          const count = event.target.files?.length ?? 0;
          if (count) setStatus(`${count} file${count > 1 ? "s" : ""} ready to upload.`);
        }}
      />
      <Button variant="ghost" size="lg" className="rounded-[10px]" onClick={() => fileInput.current?.click()}>
        <Upload aria-hidden />
        Upload Documents
      </Button>
      <Button variant="ghost" size="lg" className="rounded-[10px]" onClick={() => setStatus("Revision request sent to your coordinator.")}>
        <FilePen aria-hidden />
        Request Revision
      </Button>
      <Button variant="brand" size="lg" className="rounded-[10px] shadow-none">
        <Download aria-hidden />
        Download Report
      </Button>
      <p role="status" className={status ? "text-sm text-brand-700" : "sr-only"}>
        {status}
      </p>
    </div>
  );
}
