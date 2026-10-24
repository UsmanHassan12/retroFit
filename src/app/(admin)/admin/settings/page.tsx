import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { EmailTemplateEditor } from "@/features/admin/components/email-template-editor";
import { DEFAULT_EMAIL_TEMPLATE, INTEGRATIONS } from "@/features/admin/data";

export const metadata: Metadata = { title: "Platform Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="Platform Settings"
        description="Manage core operational parameters, security protocols, and integration health across the platform."
      />

      <section aria-labelledby="integrations" className="mt-10 rounded-2xl bg-white p-4 shadow-card">
        <h2 id="integrations" className="text-xl font-medium text-navy">
          Integration Health
        </h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {INTEGRATIONS.map((integration) => (
            <li key={integration.name} className="rounded-xl border border-line-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-navy">{integration.name}</p>
                <Badge tone="success" dot className="text-[11px] font-normal normal-case tracking-normal">
                  {integration.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{integration.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="email-template" className="mt-9 rounded-2xl bg-white p-4 shadow-card">
        <h2 id="email-template" className="text-xl font-medium text-navy">
          Email Template
        </h2>
        <div className="mt-10">
          <EmailTemplateEditor initial={DEFAULT_EMAIL_TEMPLATE} />
        </div>
      </section>
    </div>
  );
}
