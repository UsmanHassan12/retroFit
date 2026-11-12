"use client";

import { useState } from "react";

import { evaluate } from "@/server/rules/conditions";

export type IntakeQuestion = {
  key: string;
  label: string;
  help: string | null;
  type: string;
  options: Array<{ value: string; label: string }>;
  required: boolean;
  condition: unknown;
  scope: string;
};

const inputClass =
  "h-11 w-full rounded-lg border border-line-soft bg-white px-3 text-sm text-navy focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none";

/**
 * Renders intake questions from their database definitions and shows / hides them live using
 * the same condition rules the server applies (src/server/rules/conditions.ts). Field names
 * are `${prefix}.${key}` (multi-selects end in []), collected by the checkout action.
 */
export function IntakeFields({ groups, facts }: { groups: Array<{ prefix: "order" | "line"; title: string; questions: IntakeQuestion[] }>; facts: Record<string, unknown> }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const context = { ...facts, ...answers };
  const set = (key: string, value: unknown) => setAnswers((current) => ({ ...current, [key]: value }));

  return (
    <div className="grid gap-6">
      {groups.map((group) => {
        const visible = group.questions.filter((question) => evaluate(question.condition, context));
        if (!visible.length) return null;
        return (
          <fieldset key={group.prefix} className="grid gap-4">
            <legend className="text-xs font-semibold tracking-[0.05em] text-muted uppercase">{group.title}</legend>
            {visible.map((question) => {
              const id = `${group.prefix}-${question.key}`;
              const name = `${group.prefix}.${question.key}`;
              const label = (
                <span className="text-sm font-medium text-navy">
                  {question.label}
                  {question.required ? <span className="text-danger"> *</span> : null}
                </span>
              );
              if (question.type === "MULTISELECT") {
                const selected = (answers[question.key] as string[] | undefined) ?? [];
                return (
                  <div key={question.key}>
                    {label}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {question.options.map((option) => {
                        const checked = selected.includes(option.value);
                        return (
                          <label key={option.value} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${checked ? "border-brand bg-brand-100 text-brand-700" : "border-line-soft text-navy"}`}>
                            <input
                              type="checkbox"
                              name={`${name}[]`}
                              value={option.value}
                              checked={checked}
                              onChange={(event) => set(question.key, event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))}
                              className="sr-only"
                            />
                            {option.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return (
                <label key={question.key} htmlFor={id} className="grid gap-1.5">
                  {label}
                  {question.type === "SELECT" || question.type === "BOOLEAN" ? (
                    <select
                      id={id}
                      name={name}
                      required={question.required}
                      defaultValue=""
                      onChange={(event) => set(question.key, question.type === "BOOLEAN" ? (event.target.value === "" ? undefined : event.target.value === "true") : event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Choose…</option>
                      {(question.type === "BOOLEAN" ? [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] : question.options).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={id}
                      name={name}
                      type={question.type === "NUMBER" ? "number" : question.type === "DATE" ? "date" : "text"}
                      required={question.required}
                      onChange={(event) => set(question.key, question.type === "NUMBER" ? Number(event.target.value) : event.target.value)}
                      className={inputClass}
                    />
                  )}
                  {question.help ? <span className="text-xs text-muted">{question.help}</span> : null}
                </label>
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
}
