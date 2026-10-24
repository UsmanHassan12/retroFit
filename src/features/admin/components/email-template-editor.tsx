"use client";

import { Bold, Italic, List, Loader2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { saveEmailTemplate, type FormState } from "../actions";

const SAMPLE = { project_name: "RET-2026-0042", user_name: "Jane Doe", link: "#" };

/** Turn the template into plain preview text. We never inject the raw HTML (no XSS surface). */
function renderPreview(template: string) {
  const filled = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: keyof typeof SAMPLE) => SAMPLE[key] ?? "");
  return filled
    .replace(/<\/(p|h\d|div)>/gi, "\n\n")
    .replace(/<a [^>]*>(.*?)<\/a>/gi, "[$1]")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function EmailTemplateEditor({ initial }: { initial: string }) {
  const [template, setTemplate] = useState(initial);
  const [state, action, pending] = useActionState<FormState, FormData>(saveEmailTemplate, {});
  const preview = useMemo(() => renderPreview(template), [template]);

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_455px]">
      <div className="flex flex-col overflow-hidden rounded-xl border border-line-soft">
        <div className="flex gap-3 border-b border-line-soft bg-canvas px-3 py-2 text-navy" role="toolbar" aria-label="Formatting">
          <button type="button" aria-label="Bold" className="rounded p-1 hover:bg-white">
            <Bold className="size-4" aria-hidden />
          </button>
          <button type="button" aria-label="Italic" className="rounded p-1 hover:bg-white">
            <Italic className="size-4" aria-hidden />
          </button>
          <button type="button" aria-label="Bulleted list" className="rounded p-1 hover:bg-white">
            <List className="size-4" aria-hidden />
          </button>
        </div>
        <label htmlFor="email-template" className="sr-only">
          Email template HTML
        </label>
        <textarea
          id="email-template"
          name="template"
          value={template}
          onChange={(event) => setTemplate(event.target.value)}
          spellCheck={false}
          className="min-h-[300px] flex-1 resize-y p-4 font-mono text-sm leading-6 text-navy focus-visible:outline-none"
        />
        <div className="flex items-center justify-between gap-4 p-4">
          <p role="status" className={state.message ? (state.ok ? "text-sm text-brand-700" : "text-sm text-danger") : "sr-only"}>
            {state.message}
          </p>
          <Button type="submit" variant="brand" size="lg" disabled={pending} className="ml-auto w-[141px] text-base font-semibold shadow-none">
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Update
          </Button>
        </div>
      </div>

      <section aria-labelledby="email-preview" className="overflow-hidden rounded-xl border border-line-soft">
        <h3 id="email-preview" className="bg-navy px-3 py-2 text-base font-semibold text-white">
          Preview
        </h3>
        <div className="p-3 text-sm leading-6 whitespace-pre-line text-navy">{preview}</div>
      </section>
    </form>
  );
}
