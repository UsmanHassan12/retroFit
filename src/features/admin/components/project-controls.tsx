"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

import { updateProjectAction, type FormState } from "../actions";

type Option = { value: string; label: string };

type ProjectControlsProps = {
  reference: string;
  values: {
    stage: string;
    status: string;
    health: string;
    priority: string;
    coordinatorId: string;
    dueDate: string;
    issueSummary: string;
    criticalIssue: boolean;
    phaseNotice: string;
  };
  stages: Option[];
  statuses: Option[];
  healths: Option[];
  priorities: Option[];
  coordinators: Option[] | null;
};

/**
 * Stage / status / assignment panel above the task board. Moving to a stage can move the
 * status too (e.g. "QA review" → Quality check); status changes email the client.
 */
export function ProjectControls({ reference, values, stages, statuses, healths, priorities, coordinators }: ProjectControlsProps) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProjectAction.bind(null, reference), {});
  const errors = state.errors ?? {};

  return (
    <form action={action} className="mt-8 rounded-2xl bg-white p-4 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="originalStage" value={values.stage} />
        <input type="hidden" name="originalStatus" value={values.status} />
        <Field label="Stage" htmlFor="stage" error={errors.stage} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
          <Select id="stage" name="stage" defaultValue={values.stage}>
            {stages.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status" error={errors.status} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
          <Select id="status" name="status" defaultValue={values.status}>
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Health" htmlFor="health" error={errors.health} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
          <Select id="health" name="health" defaultValue={values.health}>
            {healths.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority" error={errors.priority} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
          <Select id="priority" name="priority" defaultValue={values.priority}>
            {priorities.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" htmlFor="dueDate" error={errors.dueDate} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={values.dueDate} />
        </Field>
        {coordinators ? (
          <Field label="Coordinator" htmlFor="coordinatorId" error={errors.coordinatorId} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
            <Select id="coordinatorId" name="coordinatorId" defaultValue={values.coordinatorId}>
              <option value="">Unassigned</option>
              {coordinators.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="Issue (shows in priority queue)" htmlFor="issueSummary" error={errors.issueSummary} className="lg:col-span-2" labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
          <Input id="issueSummary" name="issueSummary" defaultValue={values.issueSummary} placeholder="e.g. Missing floor plan" maxLength={200} />
        </Field>
        <label className="flex items-end gap-2 pb-3 text-sm text-navy">
          <input type="checkbox" name="criticalIssue" defaultChecked={values.criticalIssue} className="size-4 accent-brand" />
          Critical
        </label>
        <Field label="Note for the client" htmlFor="phaseNotice" error={errors.phaseNotice} className="sm:col-span-2 lg:col-span-4" labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
          <Input id="phaseNotice" name="phaseNotice" defaultValue={values.phaseNotice} placeholder="Shown on the client’s project overview" maxLength={300} />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-end gap-4">
        <p role="status" className={state.message ? `text-sm ${state.ok ? "text-brand-700" : "text-danger"}` : "sr-only"}>
          {state.message}
        </p>
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save changes
        </Button>
      </div>
    </form>
  );
}
