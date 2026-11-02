"use client";

import { Bold, Italic, List, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
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

type Tier = { key: string; name: string; price: string; days: string; deliverables: string[] };

const newTier = (name = ""): Tier => ({
  key: crypto.randomUUID(),
  name,
  price: "",
  days: "",
  deliverables: [""],
});

export function ServiceForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [tiers, setTiers] = useState<Tier[]>([
    { key: "standard", name: "Standard", price: "290", days: "3", deliverables: ["On-site property inspection", "Basic energy efficiency report"] },
  ]);
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  const errors = state.errors ?? {};

  const updateTier = (key: string, patch: Partial<Tier>) =>
    setTiers((current) => current.map((tier) => (tier.key === key ? { ...tier, ...patch } : tier)));

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
        title,
        description,
        active,
        imageUrl,
        tiers: tiers.map((tier) => ({
          name: tier.name,
          price: tier.price,
          days: tier.days,
          deliverables: tier.deliverables.filter((item) => item.trim()),
        })),
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

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-navy">Pricing Tiers</span>
              <Button variant="ocean" size="sm" onClick={() => setTiers((current) => [...current, newTier()])}>
                <Plus aria-hidden />
                Add Tier
              </Button>
            </div>
            {errors.tiers ? <p className="mt-2 text-xs text-danger">{errors.tiers}</p> : null}

            <div className="mt-4 grid gap-4">
              {tiers.map((tier, tierIndex) => (
                <fieldset key={tier.key} className="rounded-xl border border-line-soft p-4">
                  <legend className="sr-only">Tier {tierIndex + 1}</legend>
                  <div className="grid gap-6 sm:grid-cols-3">
                    <Field label="Tier name" htmlFor={`${tier.key}-name`} error={errors[`tiers.${tierIndex}.name`]} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
                      <Input id={`${tier.key}-name`} value={tier.name} onChange={(event) => updateTier(tier.key, { name: event.target.value })} />
                    </Field>
                    <Field label="Price (£)" htmlFor={`${tier.key}-price`} error={errors[`tiers.${tierIndex}.price`]} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
                      <Input id={`${tier.key}-price`} inputMode="decimal" value={tier.price} onChange={(event) => updateTier(tier.key, { price: event.target.value })} />
                    </Field>
                    <Field label="Days to complete" htmlFor={`${tier.key}-days`} error={errors[`tiers.${tierIndex}.days`]} labelClassName="text-xs font-semibold tracking-[0.05em] uppercase">
                      <Input id={`${tier.key}-days`} inputMode="numeric" value={tier.days} onChange={(event) => updateTier(tier.key, { days: event.target.value })} />
                    </Field>
                  </div>

                  <p className="mt-6 text-xs font-semibold tracking-[0.05em] text-navy uppercase">Deliverables</p>
                  <ul className="mt-3 grid gap-3">
                    {tier.deliverables.map((deliverable, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <Input
                          aria-label={`Deliverable ${index + 1}`}
                          value={deliverable}
                          onChange={(event) =>
                            updateTier(tier.key, {
                              deliverables: tier.deliverables.map((item, i) => (i === index ? event.target.value : item)),
                            })
                          }
                        />
                        <button
                          type="button"
                          aria-label={`Remove deliverable ${index + 1}`}
                          onClick={() => updateTier(tier.key, { deliverables: tier.deliverables.filter((_, i) => i !== index) })}
                          className="rounded p-2 text-navy hover:bg-canvas"
                        >
                          <X className="size-5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {errors[`tiers.${tierIndex}.deliverables`] ? (
                    <p className="mt-2 text-xs text-danger">{errors[`tiers.${tierIndex}.deliverables`]}</p>
                  ) : null}
                  <div className="mt-4 flex justify-between">
                    {tiers.length > 1 ? (
                      <Button variant="ghost" size="sm" onClick={() => setTiers((current) => current.filter((item) => item.key !== tier.key))}>
                        <Trash2 aria-hidden />
                        Remove tier
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button variant="ocean" size="sm" onClick={() => updateTier(tier.key, { deliverables: [...tier.deliverables, ""] })}>
                      <Plus aria-hidden />
                      Add Deliverable
                    </Button>
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        </div>
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
