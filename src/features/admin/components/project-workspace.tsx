"use client";

import { CircleCheck, Download, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/features/projects/components/chat-panel";
import type { Person, ProjectMessage } from "@/features/projects/types";
import { uploadProjectDocument } from "@/lib/api/client";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  addProjectDeliverable,
  decideRevisionRequest,
  issueDeliverableVersion,
  removeDeliverable,
  removeProjectDocument,
  setDeliverableStatus,
  type FormState,
} from "../actions";

/**
 * Staff side of a project: the client conversation, every uploaded file, the reports the
 * team delivers, and extra-revision requests. Uploads go browser → storage via the documents
 * API; everything else is a server action that re-checks the caller is staff.
 */

type Doc = {
  id: string;
  fileName: string;
  version: number;
  sizeBytes: number;
  category: string | null;
  uploadedAt: string;
  uploadedBy: { name: string; isClient: boolean } | null;
  href: string;
};
type Deliverable = {
  id: string;
  title: string;
  description: string;
  kind: "PDF" | "SPREADSHEET" | "REPORT";
  status: "PENDING" | "IN_PROGRESS" | "AVAILABLE";
  versioned: boolean;
  currentLabel: "INITIAL" | "REVISED" | "FINAL" | null;
  versions: Array<{ number: number; label: string; note: string | null; at: string; href: string }>;
};
type Revisions = {
  included: number;
  used: number;
  requests: Array<{ id: string; round: number; note: string; billable: boolean; pricePence: number | null; status: string; at: string }>;
};

type Props = {
  reference: string;
  /** Opened from a notification link (?tab=messages). */
  initialTab?: string;
  me: Person;
  messages: ProjectMessage[];
  documents: Doc[];
  deliverables: Deliverable[];
  revisions: Revisions;
  checklist: Array<{ key: string; label: string; required: boolean; uploaded: boolean }>;
};

type TabId = "messages" | "documents" | "deliverables" | "revisions";

const LABELS = { INITIAL: "Initial", REVISED: "Revised", FINAL: "Final" } as const;
const STATUS = {
  PENDING: { text: "Not started", tone: "bg-canvas text-muted" },
  IN_PROGRESS: { text: "In progress", tone: "bg-warning-soft text-[#9a6b00]" },
  AVAILABLE: { text: "Issued", tone: "bg-brand-100/80 text-brand-700" },
} as const;

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.docx,.xlsx";
const fileSize = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function ProjectWorkspace(props: Props) {
  const pending = props.revisions.requests.filter((request) => request.status === "REQUESTED").length;
  const issued = props.deliverables.filter((item) => item.status === "AVAILABLE").length;
  const requested = (["messages", "documents", "deliverables", "revisions"] as const).find((id) => id === props.initialTab);
  const [tab, setTab] = useState<TabId>(requested ?? (pending ? "revisions" : "messages"));

  const tabs: Array<{ id: TabId; label: string; count?: string; alert?: boolean }> = [
    { id: "messages", label: "Messages", count: String(props.messages.length) },
    { id: "documents", label: "Documents", count: String(props.documents.length) },
    { id: "deliverables", label: "Deliverables", count: `${issued}/${props.deliverables.length}` },
    { id: "revisions", label: "Revisions", count: pending ? `${pending} waiting` : undefined, alert: pending > 0 },
  ];

  return (
    <section id="workspace" aria-labelledby="workspace-heading" className="mt-10 scroll-mt-6">
      <h2 id="workspace-heading" className="text-xl font-semibold text-navy">
        Project workspace
      </h2>
      <p className="mt-1 text-sm text-muted">What the client sees and sends: messages, files, reports and revision requests.</p>

      <div role="tablist" aria-label="Project workspace" className="mt-5 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`ws-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`ws-panel-${item.id}`}
            onClick={() => setTab(item.id)}
            className={cn(
              "inline-flex h-[38px] items-center gap-2 rounded-full border px-5 text-sm transition-colors",
              tab === item.id ? "border-navy bg-navy text-white" : "border-line-soft bg-white text-navy hover:border-navy/40",
            )}
          >
            {item.label}
            {item.count ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  item.alert ? "bg-danger text-white" : tab === item.id ? "bg-white/15 text-white" : "bg-canvas text-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`ws-panel-${tab}`} aria-labelledby={`ws-tab-${tab}`} className="mt-5">
        {tab === "messages" ? (
          <div className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
            <ChatPanel projectRef={props.reference} initialMessages={props.messages} me={props.me} />
          </div>
        ) : tab === "documents" ? (
          <DocumentsPanel reference={props.reference} documents={props.documents} checklist={props.checklist} />
        ) : tab === "deliverables" ? (
          <DeliverablesPanel reference={props.reference} deliverables={props.deliverables} />
        ) : (
          <RevisionsPanel reference={props.reference} revisions={props.revisions} />
        )}
      </div>
    </section>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function Status({ state }: { state: FormState | null }) {
  if (!state?.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cn("text-sm", state.ok ? "text-brand-700" : "text-danger")}>
      {state.message}
    </p>
  );
}

/** Two-step delete so a stray click can't remove a client's file. */
function ConfirmDelete({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} disabled={disabled} aria-label={label} title={label} className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-danger disabled:opacity-40">
        <Trash2 className="size-4" aria-hidden />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <button type="button" onClick={onConfirm} className="rounded-md bg-danger px-2 py-1 font-semibold text-white">
        Delete
      </button>
      <button type="button" onClick={() => setArmed(false)} className="rounded-md px-2 py-1 text-muted hover:bg-canvas">
        Keep
      </button>
    </span>
  );
}

// ─── Documents ──────────────────────────────────────────────────────────────

function DocumentsPanel({ reference, documents, checklist }: { reference: string; documents: Doc[]; checklist: Props["checklist"] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [, startTransition] = useTransition();

  async function upload(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setUploading(true);
    setState(null);
    try {
      for (const file of list) await uploadProjectDocument(reference, file);
      setState({ ok: true, message: `${list.length} file${list.length > 1 ? "s" : ""} uploaded.` });
      router.refresh();
    } catch (error) {
      setState({ ok: false, message: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  function remove(documentId: string) {
    startTransition(async () => {
      const result = await removeProjectDocument({ reference, documentId });
      setState(result.ok ? { ok: true, message: "File deleted." } : result);
    });
  }

  const required = checklist.filter((item) => item.required);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dotted border-line px-5 py-4">
          <p className="text-sm text-muted">{documents.length ? "Every version uploaded to this project, newest first." : "No files uploaded yet."}</p>
          <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" aria-label="Choose files to upload" onChange={(event) => upload(event.target.files)} />
          <Button variant="ghost" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
            {uploading ? "Uploading…" : "Upload files"}
          </Button>
        </div>
        <ul>
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center gap-4 border-b border-dotted border-line px-5 py-3 last:border-0">
              <FileText className="size-5 shrink-0 text-ocean" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-navy">
                  {doc.fileName} <span className="text-faint">v{doc.version}</span>
                </p>
                <p className="truncate text-xs text-faint">
                  {doc.category ? `${doc.category} · ` : ""}
                  {doc.uploadedBy ? `${doc.uploadedBy.name}${doc.uploadedBy.isClient ? " (client)" : ""}` : "Unknown"} · {formatRelative(doc.uploadedAt)} · {fileSize(doc.sizeBytes)}
                </p>
              </div>
              <a href={doc.href} className="rounded-md p-1.5 text-navy hover:bg-canvas hover:text-brand" aria-label={`Download ${doc.fileName} v${doc.version}`} title="Download">
                <Download className="size-4" aria-hidden />
              </a>
              <ConfirmDelete label={`Delete ${doc.fileName} v${doc.version}`} onConfirm={() => remove(doc.id)} />
            </li>
          ))}
        </ul>
        {state ? (
          <div className="border-t border-dotted border-line px-5 py-3">
            <Status state={state} />
          </div>
        ) : null}
      </div>

      <aside aria-labelledby="doc-checklist" className="rounded-2xl bg-white p-5 shadow-card">
        <h3 id="doc-checklist" className="text-sm font-semibold text-navy">
          Documents the service needs
        </h3>
        {checklist.length ? (
          <ul className="mt-3 grid gap-2">
            {checklist.map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-sm">
                <CircleCheck className={cn("mt-0.5 size-4 shrink-0", item.uploaded ? "text-brand" : "text-line")} aria-hidden />
                <span className={item.uploaded ? "text-navy" : "text-muted"}>
                  {item.label}
                  {!item.uploaded && item.required ? <span className="text-danger"> · needed</span> : null}
                  <span className="sr-only">{item.uploaded ? " (received)" : " (not received)"}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">This service has no document list.</p>
        )}
        {required.length ? (
          <p className="mt-4 text-xs text-faint">
            {required.filter((item) => item.uploaded).length} of {required.length} required received.
          </p>
        ) : null}
      </aside>
    </div>
  );
}

// ─── Deliverables ───────────────────────────────────────────────────────────

function DeliverablesPanel({ reference, deliverables }: { reference: string; deliverables: Deliverable[] }) {
  return (
    <div className="grid gap-4">
      {deliverables.length === 0 ? <p className="rounded-2xl bg-white p-5 text-sm text-muted shadow-card">No deliverables on this project yet. Add one below.</p> : null}
      {deliverables.map((item) => (
        <DeliverableCard key={item.id} reference={reference} item={item} />
      ))}
      <AddDeliverable reference={reference} />
    </div>
  );
}

function DeliverableCard({ reference, item }: { reference: string; item: Deliverable }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const nextDefault = item.versions.length === 0 ? "INITIAL" : item.versioned ? "REVISED" : "FINAL";
  const [label, setLabel] = useState<"INITIAL" | "REVISED" | "FINAL">(nextDefault);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  const status = STATUS[item.status];
  const ids = { file: `dl-file-${item.id}`, label: `dl-label-${item.id}`, note: `dl-note-${item.id}` };

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setState({ ok: false, message: "Choose the file to issue." });
      return;
    }
    setBusy(true);
    setState(null);
    try {
      const document = await uploadProjectDocument(reference, file);
      const result = await issueDeliverableVersion({ reference, deliverableId: item.id, documentId: document.id, label, note });
      setState(result);
      if (result.ok) {
        setFile(null);
        setNote("");
        if (input.current) input.current.value = "";
        router.refresh();
      }
    } catch (error) {
      setState({ ok: false, message: error instanceof Error ? error.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(next: "PENDING" | "IN_PROGRESS") {
    startTransition(async () => setState(await setDeliverableStatus({ reference, deliverableId: item.id, status: next })));
  }

  return (
    <article className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-navy">{item.title}</h3>
          <p className="mt-0.5 text-xs text-faint">
            {item.kind === "SPREADSHEET" ? "Spreadsheet" : item.kind === "REPORT" ? "Report" : "PDF"}
            {item.versioned ? " · versioned (Initial → Revised → Final)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", status.tone)}>
            {status.text}
            {item.currentLabel ? ` · ${LABELS[item.currentLabel]}` : ""}
          </span>
          {item.status !== "AVAILABLE" ? (
            <select
              aria-label={`Progress of ${item.title}`}
              value={item.status}
              disabled={pending}
              onChange={(event) => changeStatus(event.target.value as "PENDING" | "IN_PROGRESS")}
              className="h-8 rounded-lg border border-line-soft bg-white px-2 text-xs text-navy"
            >
              <option value="PENDING">Not started</option>
              <option value="IN_PROGRESS">In progress</option>
            </select>
          ) : null}
          {item.versions.length === 0 ? (
            <ConfirmDelete
              label={`Remove ${item.title}`}
              disabled={pending}
              onConfirm={() => startTransition(async () => setState(await removeDeliverable({ reference, deliverableId: item.id })))}
            />
          ) : null}
        </div>
      </div>

      {item.versions.length ? (
        <ol className="mt-4 grid gap-1.5 border-t border-dotted border-line pt-3">
          {[...item.versions].reverse().map((version) => (
            <li key={version.number} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-navy">
                v{version.number} · {LABELS[version.label as keyof typeof LABELS] ?? version.label}
              </span>
              <span className="text-xs text-faint">{formatDate(version.at)}</span>
              {version.note ? <span className="text-xs text-muted">“{version.note}”</span> : null}
              <a href={version.href} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-ocean hover:text-brand">
                <Download className="size-3.5" aria-hidden />
                Download
              </a>
            </li>
          ))}
        </ol>
      ) : null}

      <form onSubmit={issue} className="mt-4 grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-[minmax(0,1.4fr)_140px_minmax(0,1fr)_auto] sm:items-end">
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={ids.file} className="text-xs font-semibold text-navy">
            {item.versions.length ? "Issue a new version" : "Issue to client"}
          </label>
          <input
            ref={input}
            id={ids.file}
            type="file"
            accept={ACCEPT}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="min-w-0 text-xs text-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-navy"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={ids.label} className="text-xs font-semibold text-navy">
            Version
          </label>
          <select id={ids.label} value={label} onChange={(event) => setLabel(event.target.value as typeof label)} className="h-9 rounded-lg border border-line-soft bg-white px-2 text-sm text-navy">
            {(item.versioned || item.versions.length === 0 ? (["INITIAL", "REVISED", "FINAL"] as const) : (["FINAL"] as const)).map((value) => (
              <option key={value} value={value}>
                {LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <label htmlFor={ids.note} className="text-xs font-semibold text-navy">
            Note for the client <span className="font-normal text-faint">(optional)</span>
          </label>
          <input id={ids.note} value={note} maxLength={400} onChange={(event) => setNote(event.target.value)} className="h-9 min-w-0 rounded-lg border border-line-soft bg-white px-3 text-sm text-navy" placeholder="e.g. Updated U-values" />
        </div>
        <Button type="submit" variant="brand" size="sm" className="h-9 shadow-none" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {busy ? "Issuing…" : "Upload & issue"}
        </Button>
      </form>
      {state ? (
        <div className="mt-3">
          <Status state={state} />
        </div>
      ) : null}
    </article>
  );
}

function AddDeliverable({ reference }: { reference: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"PDF" | "SPREADSHEET" | "REPORT">("PDF");
  const [state, setState] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Plus aria-hidden />
          Add a deliverable
        </Button>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await addProjectDeliverable({ reference, title, kind });
          setState(result);
          if (result.ok) {
            setTitle("");
            setOpen(false);
          }
        });
      }}
      className="grid gap-3 rounded-2xl bg-white p-5 shadow-card sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end"
    >
      <div className="grid gap-1.5">
        <label htmlFor="new-deliverable-title" className="text-xs font-semibold text-navy">
          Name
        </label>
        <input id="new-deliverable-title" required minLength={2} maxLength={140} value={title} onChange={(event) => setTitle(event.target.value)} className="h-9 rounded-lg border border-line-soft px-3 text-sm text-navy" placeholder="e.g. Ventilation strategy" />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor="new-deliverable-kind" className="text-xs font-semibold text-navy">
          Type
        </label>
        <select id="new-deliverable-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="h-9 rounded-lg border border-line-soft bg-white px-2 text-sm text-navy">
          <option value="PDF">PDF</option>
          <option value="REPORT">Report</option>
          <option value="SPREADSHEET">Spreadsheet</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="dark" size="sm" className="h-9" disabled={pending}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {state && !state.ok ? (
        <div className="sm:col-span-3">
          <Status state={state} />
        </div>
      ) : null}
    </form>
  );
}

// ─── Revisions ──────────────────────────────────────────────────────────────

const REVISION_STATUS: Record<string, { text: string; tone: string }> = {
  REQUESTED: { text: "Waiting for decision", tone: "bg-warning-soft text-[#9a6b00]" },
  ACCEPTED: { text: "Accepted", tone: "bg-brand-100/80 text-brand-700" },
  DECLINED: { text: "Declined", tone: "bg-danger/10 text-danger" },
};

function RevisionsPanel({ reference, revisions }: { reference: string; revisions: Revisions }) {
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        Revision rounds used: <span className="font-semibold text-navy tabular-nums">{revisions.used}</span> of {revisions.included} included. Rounds within the allowance start
        automatically; extra rounds wait here for a decision and are invoiced when accepted.
      </p>
      {revisions.requests.length === 0 ? <p className="rounded-2xl bg-white p-5 text-sm text-muted shadow-card">The client hasn’t requested any revisions.</p> : null}
      {revisions.requests.map((request) => (
        <RevisionCard key={request.id} reference={reference} request={request} />
      ))}
    </div>
  );
}

function RevisionCard({ reference, request }: { reference: string; request: Revisions["requests"][number] }) {
  const [price, setPrice] = useState(request.pricePence !== null ? String(request.pricePence / 100) : "");
  const [state, setState] = useState<FormState | null>(null);
  const [pending, startTransition] = useTransition();
  const status = REVISION_STATUS[request.status] ?? { text: request.status, tone: "bg-canvas text-muted" };

  const decide = (accept: boolean) =>
    startTransition(async () => setState(await decideRevisionRequest({ reference, revisionId: request.id, accept, price: request.billable ? price : undefined })));

  return (
    <article className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-navy">
          Round {request.round} {request.billable ? <span className="text-sm font-normal text-muted">· extra round (billable)</span> : <span className="text-sm font-normal text-muted">· included</span>}
        </h3>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", status.tone)}>{status.text}</span>
      </div>
      <p className="mt-1 text-xs text-faint">Requested {formatRelative(request.at)}</p>
      <blockquote className="mt-3 rounded-xl bg-canvas px-4 py-3 text-sm whitespace-pre-wrap text-navy">{request.note}</blockquote>

      {request.status === "REQUESTED" ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {request.billable ? (
            <div className="grid gap-1.5">
              <label htmlFor={`rev-price-${request.id}`} className="text-xs font-semibold text-navy">
                Price (£, excl. VAT)
              </label>
              <input
                id={`rev-price-${request.id}`}
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="h-9 w-32 rounded-lg border border-line-soft px-3 text-sm text-navy tabular-nums"
              />
            </div>
          ) : null}
          <Button variant="brand" size="sm" className="h-9 shadow-none" disabled={pending} onClick={() => decide(true)}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {request.billable ? "Accept & invoice" : "Accept"}
          </Button>
          <Button variant="ghost" size="sm" className="h-9" disabled={pending} onClick={() => decide(false)}>
            Decline
          </Button>
        </div>
      ) : request.pricePence ? (
        <p className="mt-3 text-xs text-muted">Price: £{(request.pricePence / 100).toFixed(2)} + VAT</p>
      ) : null}
      {state ? (
        <div className="mt-3">
          <Status state={state} />
        </div>
      ) : null}
    </article>
  );
}
