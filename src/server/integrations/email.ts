import "server-only";

import { db } from "../db";
import { env, integrations } from "../env";
import type { EmailTemplateKey } from "../domain";
import { renderTemplate } from "./template";

export { renderTemplate };

/**
 * Transactional email. SendGrid's v3 API when SENDGRID_API_KEY is set, otherwise the
 * message is printed to the server console (handy for reset / invite links in dev).
 * Templates are editable by admins (Settings → Email templates); the defaults below are
 * used until a template is saved, and "reset" deletes the override.
 */

export const DEFAULT_TEMPLATES: Record<EmailTemplateKey, { subject: string; html: string; variables: string[] }> = {
  project_update: {
    subject: "Project update: {{project_name}}",
    variables: ["user_name", "project_name", "project_ref", "phase", "link"],
    html: `<div class="header">
  <h2>Project Update: {{project_name}}</h2>
</div>
<p>Hello {{user_name}},</p>
<p>Your project <strong>{{project_ref}}</strong> has moved to <strong>{{phase}}</strong>.</p>
<a href="{{link}}" class="btn">View Status</a>`,
  },
  invite: {
    subject: "You've been invited to Retrofit Portal",
    variables: ["inviter_name", "role", "link"],
    html: `<h2>Join the Retrofit Portal team</h2>
<p>{{inviter_name}} has invited you to join Retrofit Portal as a <strong>{{role}}</strong>.</p>
<a href="{{link}}" class="btn">Accept invitation</a>
<p>This link expires in 7 days.</p>`,
  },
  password_reset: {
    subject: "Reset your Retrofit Portal password",
    variables: ["user_name", "link"],
    html: `<h2>Reset your password</h2>
<p>Hello {{user_name}},</p>
<p>We received a request to reset your password. The link below is valid for 1 hour.</p>
<a href="{{link}}" class="btn">Choose a new password</a>
<p>If you didn't ask for this, you can ignore this email.</p>`,
  },
  order_confirmation: {
    subject: "Order confirmed: {{service_name}} ({{project_ref}})",
    variables: ["user_name", "service_name", "tier_name", "order_ref", "project_ref", "total", "link"],
    html: `<h2>Thank you for your order</h2>
<p>Hello {{user_name}},</p>
<p>Your order <strong>{{order_ref}}</strong> for <strong>{{service_name}} ({{tier_name}})</strong> is confirmed.
Total paid: <strong>{{total}}</strong> incl. VAT.</p>
<p>We've created project <strong>{{project_ref}}</strong>. Your coordinator will be in touch within one working day.</p>
<a href="{{link}}" class="btn">Open your project</a>`,
  },
};

const LAYOUT = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#f4f7fa;font-family:Inter,Arial,sans-serif;color:#0b1c30}
.wrap{max-width:560px;margin:0 auto;padding:32px 16px}
.card{background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(11,28,48,.08)}
.header h2,h2{margin:0 0 16px;font-size:22px}
p{line-height:1.6;font-size:15px}
.btn{display:inline-block;margin-top:8px;padding:12px 22px;background:#0b1c30;color:#fff!important;text-decoration:none;border-radius:8px;font-weight:600}
.foot{margin-top:24px;text-align:center;font-size:12px;color:#6b7a90}
</style></head><body><div class="wrap"><div class="card">${body}</div><p class="foot">Retrofit Portal · PAS 2035 retrofit services</p></div></body></html>`;

export async function loadTemplate(key: EmailTemplateKey) {
  const saved = await db.emailTemplate.findUnique({ where: { key } });
  const fallback = DEFAULT_TEMPLATES[key];
  return { key, subject: saved?.subject ?? fallback.subject, html: saved?.html ?? fallback.html, custom: Boolean(saved) };
}

export function renderEmail(template: { subject: string; html: string }, variables: Record<string, string | number>) {
  return {
    subject: renderTemplate(template.subject, variables, false),
    html: LAYOUT(renderTemplate(template.html, variables)),
  };
}

export async function sendEmail(message: { to: string; subject: string; html: string }) {
  const config = env();
  if (!integrations.sendgrid()) {
    const text = message.html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<a [^>]*href="([^"]+)"[^>]*>/g, "[$1] ").replace(/<[^>]+>/g, " ");
    console.info(`\n[email] To: ${message.to}\n[email] Subject: ${message.subject}\n[email] ${text.replace(/\s+/g, " ").trim()}\n`);
    return;
  }

  const from = parseAddress(config.EMAIL_FROM);
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: message.to }] }],
      from,
      subject: message.subject,
      content: [{ type: "text/html", value: message.html }],
    }),
  });
  if (!response.ok) {
    // Email is best-effort: log and carry on so a mail outage never fails a payment or signup.
    console.error(`[email] SendGrid ${response.status}: ${await response.text().catch(() => "")}`);
  }
}

/** Render a stored (or default) template and send it. Never throws. */
export async function sendTemplate(key: EmailTemplateKey, to: string, variables: Record<string, string | number>) {
  try {
    const rendered = renderEmail(await loadTemplate(key), variables);
    await sendEmail({ to, ...rendered });
  } catch (error) {
    console.error(`[email] Failed to send ${key} to ${to}`, error);
  }
}

function parseAddress(value: string) {
  const match = /^(.*)<([^>]+)>$/.exec(value.trim());
  return match ? { name: match[1]!.trim(), email: match[2]!.trim() } : { email: value.trim() };
}
