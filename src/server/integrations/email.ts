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
    subject: "Booking confirmed: {{service_name}} ({{order_ref}})",
    variables: ["user_name", "service_name", "order_ref", "project_ref", "total", "payment", "link"],
    html: `<h2>Thank you for your booking</h2>
<p>Hello {{user_name}},</p>
<p>Your order <strong>{{order_ref}}</strong> for <strong>{{service_name}}</strong> is confirmed.
Total: <strong>{{total}}</strong> incl. VAT. {{payment}}</p>
<p>Project(s): <strong>{{project_ref}}</strong>. If we still need any details or documents, the project page lists them.</p>
<a href="{{link}}" class="btn">Open your project</a>`,
  },
  invoice_issued: {
    subject: "Invoice {{invoice_number}}: {{total}} due {{due}}",
    variables: ["user_name", "invoice_number", "total", "due", "link"],
    html: `<h2>Your weekly invoice</h2>
<p>Hello {{user_name}},</p>
<p>Invoice <strong>{{invoice_number}}</strong> for this week's bookings is ready: <strong>{{total}}</strong> incl. VAT.</p>
<p>Please pay by <strong>{{due}}</strong> (UK time) by card or bank transfer. Unpaid accounts are placed on hold.</p>
<a href="{{link}}" class="btn">View and pay</a>`,
  },
  invoice_reminder: {
    subject: "Reminder: invoice {{invoice_number}} is due {{due}}",
    variables: ["user_name", "invoice_number", "total", "due", "link"],
    html: `<h2>Payment reminder</h2>
<p>Hello {{user_name}},</p>
<p>Invoice <strong>{{invoice_number}}</strong> ({{total}}) is due by <strong>{{due}}</strong> UK time.
If it isn't paid by then, new bookings are paused and work on open projects stops until it is settled.</p>
<a href="{{link}}" class="btn">Pay now</a>`,
  },
  account_hold: {
    subject: "Your Retrofit Portal account is on hold",
    variables: ["user_name", "reason", "link"],
    html: `<h2>Account on hold</h2>
<p>Hello {{user_name}},</p>
<p>Your account has been placed on hold: {{reason}}.</p>
<p>While on hold, new bookings are blocked, work on open projects is paused and deliverables can't be downloaded.
Paying in full lifts the hold automatically, and turnaround times restart from then.</p>
<a href="{{link}}" class="btn">Settle your account</a>`,
  },
  hold_lifted: {
    subject: "Your account hold has been lifted",
    variables: ["user_name", "link"],
    html: `<h2>Hold lifted</h2>
<p>Hello {{user_name}},</p>
<p>Thank you. Your account is active again: you can book, and work on your projects has resumed.</p>
<a href="{{link}}" class="btn">Go to your dashboard</a>`,
  },
  partner_application: {
    subject: "New Premium Partner application: {{company}}",
    variables: ["company", "user_email", "link"],
    html: `<h2>New partner application</h2>
<p><strong>{{company}}</strong> ({{user_email}}) has applied to become a Premium Partner.</p>
<a href="{{link}}" class="btn">Review application</a>`,
  },
  partner_offer: {
    subject: "Your Premium Partner application is approved",
    variables: ["user_name", "company", "discount", "payment_mode", "fee", "link"],
    html: `<h2>Welcome aboard, {{company}}</h2>
<p>Hello {{user_name}},</p>
<p>Your application is approved: <strong>{{discount}}</strong> off list prices, paying by <strong>{{payment_mode}}</strong>.</p>
<p>To activate, sign the partner agreement online and start the {{fee}} + VAT monthly subscription.</p>
<a href="{{link}}" class="btn">Sign and activate</a>`,
  },
  partner_activated: {
    subject: "Your Premium Partner account is active",
    variables: ["user_name", "company", "link"],
    html: `<h2>You're a Premium Partner</h2>
<p>Hello {{user_name}},</p>
<p>{{company}} is now active: partner prices, fast-track turnaround and the priority queue apply to every new booking.</p>
<a href="{{link}}" class="btn">Book a service</a>`,
  },
  credit_receipt: {
    subject: "Receipt {{receipt_number}}: {{amount}} account credit",
    variables: ["user_name", "amount", "balance", "receipt_number", "link"],
    html: `<h2>Credit added</h2>
<p>Hello {{user_name}},</p>
<p>We've added <strong>{{amount}}</strong> to your account credit (receipt {{receipt_number}}). Your balance is now <strong>{{balance}}</strong>.</p>
<a href="{{link}}" class="btn">View billing</a>`,
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
