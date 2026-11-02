"use client";

import { FileUp } from "lucide-react";
import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** Drag-and-drop file picker. The chosen (or dropped) file is submitted with the surrounding form. */
export function UploadDropzone({
  title,
  hint = "PDF, JPEG, or PNG up to 10MB",
  name = "file",
  accept = ".pdf,.jpg,.jpeg,.png",
  className,
}: {
  title: string;
  hint?: string;
  name?: string;
  accept?: string;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
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
        if (!file) return;
        // Put the dropped file into the real input so it is submitted with the form.
        if (input.current) {
          const transfer = new DataTransfer();
          transfer.items.add(file);
          input.current.files = transfer.files;
        }
        setFileName(file.name);
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
        ref={input}
        accept={accept}
        className="sr-only"
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
      />
    </label>
  );
}
