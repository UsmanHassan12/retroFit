"use client";

import { FileUp } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/** Drag-and-drop file picker (PDF / JPEG / PNG up to 10MB). */
export function UploadDropzone({
  title,
  hint = "PDF, JPEG, or PNG up to 10MB",
  name = "file",
  className,
}: {
  title: string;
  hint?: string;
  name?: string;
  className?: string;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <label
      htmlFor={id}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) setFileName(file.name);
      }}
      className={cn(
        "flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-xl border border-line-soft bg-white px-6 py-10 text-center transition-colors hover:border-brand/60",
        dragging && "border-brand bg-brand-50",
        className,
      )}
    >
      <FileUp className="size-8 text-navy" strokeWidth={1.5} aria-hidden />
      <span className="mt-4 text-base font-semibold text-navy">{fileName ?? title}</span>
      <span className="mt-1 text-base text-muted">{fileName ? "Ready to upload" : hint}</span>
      <input
        id={id}
        name={name}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
      />
    </label>
  );
}
