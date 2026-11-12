"use client";

import { Bold, Italic, List, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { UploadDropzone } from "@/components/ui/upload-dropzone";

import { api } from "@/lib/api/client";

import { saveService, type FormState } from "../actions";

/** Upload the cover image straight to storage; returns its public URL. */
async function uploadImage(file: File) {
  const { publicUrl, upload } = await api<{ publicUrl: string; upload: { url: string; method: "PUT"; headers: Record<string, string> } }>(
    "/api/admin/uploads",
    { method: "POST", json: { fileName: file.name, mimeType: file.type, sizeBytes: file.size } },
  );
  const response = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file });
  if (!response.ok) throw new Error("The image upload failed. Please try again.");
  return publicUrl;
}

type Stage = { key: string; name: string; role: string; slaDays: string; status: string };

const newStage = (name = "", role = "COORDINATOR", status = ""): Stage => ({ key: crypto.randomUUID(), name, role, slaDays: "", status });

const CATEGORIES = ["ASSESSMENT", "DESIGN", "COORDINATION", "CALCULATIONS", "SURVEYS", "FUNDING", "COMPLIANCE"];
const UNITS = [
  ["PROPERTY", "Per property"],
  ["ELEMENT", "Per element"],
  ["JUNCTION", "Per junction"],
  ["VISIT", "Per visit"],
  ["PACKAGE", "Per package"],
] as const;
const ROLES = ["ASSESSOR", "DESIGNER", "COORDINATOR", "ADMIN"];
const STATUSES = [
  ["", "Keep status"],
  ["SCHEDULED", "Visit scheduled"],
  ["IN_PROGRESS", "In progress"],
  ["IN_QA", "Quality check"],
  ["DELIVERED", "Delivered"],
  ["COMPLETED", "Completed"],
] as const;
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

/**
 * Add a service. Prices, turnaround and stages are placeholders until StepSoft confirms, so
 * everything here is editable later. Intake questions, document lists and add-ons are edited
 * through PUT /api/admin/services/:id.
 */
export function ServiceForm() {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("ASSESSMENT");
  const [active, setActive] = useState(true);
  const [pricing, setPricing] = useState({ priceUnit: "PROPERTY", listPrice: "", siteVisit: "NONE", standardDays: "", fastTrackDays: "", revisionRounds: "2" });
  const [stages, setStages] = useState<Stage[]>([newStage("Order confirmed"), newStage("Work in progress", "COORDINATOR", "IN_PROGRESS"), newStage("QA", "COORDINATOR", "IN_QA"), newStage("Delivered", "COORDINATOR", "DELIVERED")]);
  const [deliverables, setDeliverables] = useState<string[]>([""]);
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  const errors = state.errors ?? {};

  const updateStage = (key: string, patch: Partial<Stage>) => setStages((current) => current.map((stage) => (stage.key === key ? { ...stage, ...patch } : stage)));
  const setPrice = (patch: Partial<typeof pricing>) => setPricing((current) => ({ ...current, ...patch }));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const media = new FormData(event.currentTarget).get("media");
    startTransition(async () => {
      let imageUrl: string | undefined;
      if (media instanceof File && media.size > 0) {
        try {
          imageUrl = await uploadImage(media);
        } catch (error) {
          setState({ ok: false, message: error instanceof Error ? error.message : "The image upload failed." });
          return;
        }
      }
      const result = await saveService({
        code,
        title,
        description,
        category,
        active,
        imageUrl,
        ...pricing,
        stages: stages.map(({ name, role, slaDays, status }) => ({ name, role, slaDays, status })),
        deliverables: deliverables.map((item) => item.trim()).filter(Boolean),
      });
      if (result) setState(result);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <section className="rounded-2xl bg-white p-4 shadow-card">
        <h2 className="text-xl font-medium text-navy">General Information</h2>
        <div className="mt-8 grid gap-6">
          <Field label="Service Title" htmlFor="title" error={errors.title} labelClassName="text-xs font-normal">
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Comprehensive Energy Audit"
              aria-invalid={Boolean(errors.title)}
            />
          </Field>

          <Field label="Description" htmlFor="description" error={errors.description} labelClassName="text-xs font-normal">
            <div className="overflow-hidden rounded-[10px] border border-line-soft focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
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
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the service..."
                className="min-h-[186px] rounded-none border-0 shadow-none focus-visible:ring-0"
                aria-invalid={Boolean(errors.description)}
              />
            </div>
          </Field>

          <div className="grid gap-2">
            <span className="text-xs text-navy">Media</span>
            <UploadDropzone title="Upload a cover image" hint="JPEG, PNG or WebP up to 10MB" name="media" accept=".jpg,.jpeg,.png,.webp" className="min-h-[210px]" />
          </div>

        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-card">
        <h2 className="text-xl font-medium text-navy">Pricing &amp; delivery</h2>
        <p className="mt-1 text-sm text-faint">One list price per unit (excl. VAT). Partners get their discount and the fast-track turnaround automatically.</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <Field label="Code" htmlFor="code" error={errors.code} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
            <Input id="code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="e.g. RA" maxLength={8} />
          </Field>
          <Field label="Category" htmlFor="category" error={errors.category} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
            <Select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Price unit" htmlFor="priceUnit" error={errors.priceUnit} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
            <Select id="priceUnit" value={pricing.priceUnit} onChange={(event) => setPrice({ priceUnit: event.target.value })}>
              {UNITS.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="List price (£)" htmlFor="listPrice" error={errors.listPrice} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
            <Input id="listPrice" inputMode="decimal" value={pricing.listPrice} onChange={(event) => setPrice({ listPrice: event.target.value })} placeholder="225" />
          </Field>
          <Field label="Site visit" htmlFor="siteVisit" error={errors.siteVisit} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
            <Select id="siteVisit" value={pricing.siteVisit} onChange={(event) => setPrice({ siteVisit: event.target.value })}>
              <option value="NONE">No</option>
              <option value="REQUIRED">Yes</option>
              <option value="OPTIONAL">Optional</option>
            </Select>
          </Field>
          <Field label="Revision rounds" htmlFor="revisionRounds" error={errors.revisionRounds} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
            <Input id="revisionRounds" inputMode="numeric" value={pricing.revisionRounds} onChange={(event) => setPrice({ revisionRounds: event.target.value })} />
          </Field>
          <Field label="Standard days" htmlFor="standardDays" error={errors.standardDays} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
            <Input id="standardDays" inputMode="numeric" value={pricing.standardDays} onChange={(event) => setPrice({ standardDays: event.target.value })} placeholder="Working days (blank = agreed)" />
          </Field>
          <Field label="Partner / fast-track days" htmlFor="fastTrackDays" error={errors.fastTrackDays} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
            <Input id="fastTrackDays" inputMode="numeric" value={pricing.fastTrackDays} onChange={(event) => setPrice({ fastTrackDays: event.target.value })} placeholder="0 = same day" />
          </Field>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-navy">Workflow stages</h2>
          <Button variant="ocean" size="sm" onClick={() => setStages((current) => [...current, newStage()])}>
            <Plus aria-hidden />
            Add stage
          </Button>
        </div>
        {errors.stages ? <p className="mt-2 text-xs text-danger">{errors.stages}</p> : null}
        <ol className="mt-4 grid gap-3">
          {stages.map((stage, index) => (
            <li key={stage.key} className="grid items-end gap-3 rounded-xl border border-line-soft p-3 sm:grid-cols-[1fr_150px_100px_170px_auto]">
              <Field label={`Stage ${index + 1}`} htmlFor={`${stage.key}-name`} error={errors[`stages.${index}.name`]} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
                <Input id={`${stage.key}-name`} value={stage.name} onChange={(event) => updateStage(stage.key, { name: event.target.value })} />
              </Field>
              <Field label="Role" htmlFor={`${stage.key}-role`} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
                <Select id={`${stage.key}-role`} value={stage.role} onChange={(event) => updateStage(stage.key, { role: event.target.value })}>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {label(role)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="SLA days" htmlFor={`${stage.key}-sla`} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
                <Input id={`${stage.key}-sla`} inputMode="numeric" value={stage.slaDays} onChange={(event) => updateStage(stage.key, { slaDays: event.target.value })} />
              </Field>
              <Field label="Sets status" htmlFor={`${stage.key}-status`} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
                <Select id={`${stage.key}-status`} value={stage.status} onChange={(event) => updateStage(stage.key, { status: event.target.value })}>
                  {STATUSES.map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </Select>
              </Field>
              <button type="button" aria-label={`Remove stage ${index + 1}`} onClick={() => setStages((current) => current.filter((item) => item.key !== stage.key))} className="mb-1 rounded p-2 text-navy hover:bg-canvas">
                <Trash2 className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium text-navy">Deliverables</h2>
          <Button variant="ocean" size="sm" onClick={() => setDeliverables((current) => [...current, ""])}>
            <Plus aria-hidden />
            Add deliverable
          </Button>
        </div>
        <ul className="mt-4 grid gap-3">
          {deliverables.map((deliverable, index) => (
            <li key={index} className="flex items-center gap-3">
              <Input aria-label={`Deliverable ${index + 1}`} value={deliverable} onChange={(event) => setDeliverables((current) => current.map((item, i) => (i === index ? event.target.value : item)))} />
              <button type="button" aria-label={`Remove deliverable ${index + 1}`} onClick={() => setDeliverables((current) => current.filter((_, i) => i !== index))} className="rounded p-2 text-navy hover:bg-canvas">
                <X className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex items-center justify-between gap-6 rounded-2xl bg-white p-4 shadow-card">
        <div>
          <h2 className="text-xl font-medium text-navy">Service Active</h2>
          <p className="mt-2 text-sm text-faint">Make this service immediately available for booking upon publishing.</p>
        </div>
        <Switch label="Service active" defaultChecked={active} onCheckedChange={setActive} />
      </section>

      {state.message ? (
        <p role="alert" className="text-center text-sm text-danger">
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-center">
        <Button type="submit" variant="brand" size="lg" disabled={pending} className="w-full max-w-[332px] text-base font-semibold">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save
        </Button>
      </div>
    </form>
  );
}
