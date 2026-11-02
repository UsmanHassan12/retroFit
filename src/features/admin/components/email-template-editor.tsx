"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

import { saveEmailTemplate, type FormState } from "../actions";

export type TemplateView = { key: string; label: string; subject: string; html: string; custom: boolean; variables: string[] };

const SAMPLE: Record<string, string> = {
  project_name: "Whole-House Retrofit Assessment",
  project_ref: "RET-2026-0042",
  user_name: "Jane Doe",
  phase: "Technical Survey",
  inviter_name: "John Smith",
  role: "Coordinator",
  service_name: "Whole-House Retrofit Assessment",
  tier_name: "Premium",
  order_ref: "ORD-2026-000123",
  total: "£2,182.80",
  link: "#",
};

/** Turn the template into plain preview text. We never inject the raw HTML (no XSS surface). */
function renderPreview(template: string) {
  const filled = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => SAMPLE[key] ?? "");
  return filled
    .replace(/<\/(p|h\d|div)>/gi, "\n\n")
    .replace(/<a [^>]*>(.*?)<\/a>/gi, "[$1]")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function EmailTemplateEditor({ templates }: { templates: TemplateView[] }) {
  const [key, setKey] = useState(templates[0]?.key ?? "");
  const current = templates.find((template) => template.key === key) ?? templates[0]!;
  const [drafts, setDrafts] = useState<Record<string, { subject: string; html: string }>>({});
  const draft = drafts[key] ?? { subject: current.subject, html: current.html };
  const [state, action, pending] = useActionState<FormState, FormData>(saveEmailTemplate, {});
  const preview = useMemo(() => renderPreview(draft.html), [draft.html]);

  const update = (patch: Partial<typeof draft>) => setDrafts((all) => ({ ...all, [key]: { ...draft, ...patch } }));

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_455px]">
      <input type="hidden" name="key" value={key} />
      <div className="flex flex-col overflow-hidden rounded-xl border border-line-soft">
        <div className="grid gap-4 border-b border-line-soft bg-canvas p-3 sm:grid-cols-2">
          <Field label="Template" htmlFor="template-key" labelClassName="text-xs font-normal">
            <Select id="template-key" value={key} onChange={(event) => setKey(event.target.value)}>
              {templates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                  {template.custom ? " (customised)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" htmlFor="template-subject" error={state.errors?.subject} labelClassName="text-xs font-normal">
            <Input id="template-subject" name="subject" value={draft.subject} onChange={(event) => update({ subject: event.target.value })} />
          </Field>
        </div>
        <label htmlFor="email-template" className="sr-only">
          Email template HTML
        </label>
        <textarea
          id="email-template"
          name="template"
          value={draft.html}
          onChange={(event) => update({ html: event.target.value })}
          spellCheck={false}
          className="min-h-[300px] flex-1 resize-y p-4 font-mono text-sm leading-6 text-navy focus-visible:outline-none"
        />
        <p className="border-t border-line-soft px-4 py-2 text-xs text-muted">
          Placeholders: {current.variables.map((variable) => `{{${variable}}}`).join(", ")}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <p role="status" className={state.message ? (state.ok ? "text-sm text-brand-700" : "text-sm text-danger") : "sr-only"}>
            {state.message}
          </p>
          <div className="ml-auto flex gap-3">
            {current.custom ? (
              <Button type="submit" name="intent" value="reset" variant="ghost" size="lg" disabled={pending} className="text-base">
                Reset to default
              </Button>
            ) : null}
            <Button type="submit" name="intent" value="save" variant="brand" size="lg" disabled={pending} className="w-[141px] text-base font-semibold shadow-none">
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Update
            </Button>
          </div>
        </div>
      </div>

      <section aria-labelledby="email-preview" className="overflow-hidden rounded-xl border border-line-soft">
        <h3 id="email-preview" className="bg-navy px-3 py-2 text-base font-semibold text-white">
          Preview
        </h3>
        <p className="border-b border-line-soft px-3 py-2 text-sm font-semibold text-navy">{renderPreview(draft.subject)}</p>
        <div className="p-3 text-sm leading-6 whitespace-pre-line text-navy">{preview}</div>
      </section>
    </form>
  );
}
