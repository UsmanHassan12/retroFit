# Retrofit Portal: Backend

Backend for **RetrofitPortal.co.uk**, built from the Figma design (Services → Review Order → Payment → Client Dashboard → Admin). It lives inside the Next.js app: route handlers in `src/app/api`, business logic in `src/server`.

**Stack:** Next.js 16 (App Router route handlers + Server Actions) · Prisma 6 · PostgreSQL 16 · Zod 4 · JWT session cookie (HS256 via WebCrypto, no extra dependency) · scrypt password hashing (Node built-in) · Stripe · AWS S3 · SendGrid

## Getting started

```bash
cp .env.example .env               # set DATABASE_URL and AUTH_SECRET (32+ characters)
npm install                        # also runs `prisma generate`
npm run db:up                      # Postgres 16 in Docker (or point DATABASE_URL at your own)
npm run db:migrate -- --name init
npm run db:seed                    # demo data from the Figma screens (wipes existing data)
npm run dev                        # http://localhost:3000/api/health
```

**Seeded accounts.** The admin uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (defaults `admin@retrofitportal.co.uk` / `Admin123!`). All other demo accounts use the password `Retrofit123!`:
- `sarah.jenkins@example.com` is the client (Priority plan). She owns project **RET-2026-0042** at 124 Oakwood Crescent (ECO4, Technical Survey phase, 65%) and six more.
- `john.hopkins@retrofitportal.co.uk` is the coordinator. `mike.ross@…` is an assessor. `jane.doe@…`, `rob.clarke@…`, `marie.dubois@…` and `aron.patel@…` are other staff. Four more clients own the admin-directory projects.
- Discount codes `RETRO2024` and `RETRO2026` give 10% off, `WELCOME5` gives 5%.

**Running without third-party keys:**
- **Stripe:** if `STRIPE_SECRET_KEY` is empty and you're not in production, checkout marks the order paid straight away and creates the project, so the whole flow works locally. "Upgrade to Priority" also switches the plan on directly.
- **SendGrid:** if `SENDGRID_API_KEY` is empty, emails (reset links, invites, confirmations) are printed to the server console.
- **S3:** if `S3_BUCKET` is empty, files are stored in `./.uploads` behind short-lived HMAC-signed URLs (`/api/uploads/local`). Production requires S3.

**Stripe webhook (local):** `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Put the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`. Events handled: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `charge.refunded`.

## Code layout

```
prisma/schema.prisma        data model        prisma/seed.ts   demo data
src/server/
  db.ts env.ts http.ts errors.ts domain.ts
  auth/          jwt.ts · password.ts · session.ts · permissions.ts
  integrations/  stripe.ts · storage.ts (S3 / local) · email.ts (SendGrid / console) · template.ts
  services/      auth · catalog · orders · pricing · references · projects · tasks · documents ·
                 messages · deliverables · account · billing · admin · media · audit
src/app/api/**   thin route handlers, one per endpoint below
tests/           node:test unit tests (npm test)
```

Pages don't call the API over HTTP: Server Components use `features/*/queries.ts` and Server Actions use `features/*/actions.ts`, both of which call the same `src/server/services`. The browser uses the JSON API for chat, uploads and the task board.

## Roles & access

| Role | Can do |
|---|---|
| `CLIENT` | Buy services, see **own** projects, chat, upload docs, manage profile, properties and billing |
| `ASSESSOR`, `DESIGNER`, `COORDINATOR` | Admin area for projects they coordinate or are a member of (or all, with "View all projects"); task board; deliverables |
| `COORDINATOR` | Also change a project's coordinator and team |
| `ADMIN` | Everything, plus services, users and invites, impersonation, settings, email templates, discount codes, revenue |

The session is an httpOnly cookie, `rp_session`, holding a signed HS256 JWT (7 days; 1 hour while impersonating). `proxy.ts` verifies it for fast page redirects. Every API handler and page re-loads the user from the database, so suspending a user, changing their role or changing their password (`sessionVersion`) revokes existing sessions immediately. Clients get a **404** for other people's projects, not a 403. Sensitive admin actions are written to `AuditLog`.

## API

All responses are JSON. Errors look like `{ error: { code, message, details? } }` (`details` holds per-field messages for validation errors). Money is always in **pence** (`*Pence`).

### Health
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Database check and which integrations are configured |

### Auth (Login / Sign Up screens)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{ email, password, confirmPassword, firstName?, lastName? }` creates a CLIENT and signs them in |
| POST | `/api/auth/login` | `{ email, password }`. Locks the account for 15 min after 5 failed attempts (stored in the database) |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | Current user and plan, plus `impersonating` flag |
| POST | `/api/auth/forgot-password` | `{ email }`. Always returns 200. Emails a 1-hour link to `/reset-password?token=` |
| POST | `/api/auth/reset-password` | `{ token, password, confirmPassword }`. Signs out other sessions and signs in |
| GET | `/api/auth/accept-invite?token=` | `{ email, role }` of a pending invite |
| POST | `/api/auth/accept-invite` | `{ token, firstName, lastName, password, confirmPassword }` for staff invites |
| POST | `/api/auth/impersonation/stop` | Returns an impersonating admin to their own account |

### Services catalogue (public)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/services?q=&category=ASSESSMENT,DESIGN&budget=under-500\|500-1000\|1000+` | Service cards with `fromPricePence` and turnaround |
| GET | `/api/services/:slug` | Detail with tiers (Basic/Standard/Premium), add-ons, timeline milestones, compliance points |
| GET | `/api/plans` | Free / Priority / Enterprise pricing cards |

### Orders & checkout (Review Order → Payment Confirmation)
| Method | Path | Notes |
|---|---|---|
| POST | `/api/orders/quote` | `{ serviceId, tierId, addonIds[], discountCode? }` price preview, nothing saved |
| POST | `/api/orders` | `{ serviceId, tierId, addonIds[], propertyId?, discountCode? }` creates a DRAFT order with the price breakdown. Ids or storefront keys are accepted (slug, `premium`, `regulatory-filing`) |
| GET | `/api/orders` / `/api/orders/:idOrRef` | Order history / receipt |
| PATCH | `/api/orders/:id` | Change tier, add-ons, property or discount code while DRAFT |
| DELETE | `/api/orders/:id` | Cancel an unpaid order |
| POST | `/api/orders/:id/checkout` | "Complete Purchase". Returns `{ url, paid }` — Stripe Checkout, or the confirmation page in dev without Stripe |
| POST | `/api/webhooks/stripe` | When paid, creates the project (reference `RET-YYYY-NNNN`) with milestones, deliverables, first tasks and an auto-assigned coordinator, then sends the confirmation email. Idempotent |

**Pricing** matches the receipt: (base + add-ons − discount) + 20% VAT, rounded to the penny at each step. £1,450 + £369 → VAT £363.80 → **£2,182.80**. The Priority plan's 15% off and a discount code don't stack; the larger one applies.

### Client dashboard
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard` | Active / Completed / Funding Secured / Compliance, active projects, recent activity |
| GET | `/api/projects?status=all\|active\|completed&q=` | "Your Projects" |
| GET | `/api/projects/:ref` | Overview: header, coordinator, team, property, current phase, milestones, activity |
| GET | `/api/projects/:ref/tasks` | "Task & Docs" (clients only see tasks marked visible to them) |
| GET | `/api/projects/:ref/documents?all=true` | "Your Documents" — latest version of each file, or every version with `all=true` |
| POST | `/api/projects/:ref/documents` | `{ fileName, mimeType, sizeBytes, category? }` (PDF/JPEG/PNG ≤ 10 MB) → `{ document, upload: { url, method, headers } }`. PUT the file to `upload.url`, then confirm |
| POST | `/api/projects/:ref/documents/:docId/confirm` | Checks the object exists, publishes it and logs activity. Re-uploading the same file name bumps its version |
| GET / DELETE | `/api/projects/:ref/documents/:docId` | Metadata + signed `downloadUrl` (add `?download=1` to be redirected) / delete (uploader or staff) |
| GET / POST | `/api/projects/:ref/messages?after=ISO` | Project Chat. Poll with `after`. Staff replies email the client |
| GET | `/api/projects/:ref/timeline` | Milestones (done / current / upcoming) and activity |
| GET / POST | `/api/projects/:ref/deliverables` | List; staff can add |
| GET | `/api/projects/:ref/deliverables/:id/download` | Redirects to a signed URL once AVAILABLE |

### Profile & billing
| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/api/me/profile` | Name, phone, avatar URL, push notifications (email changes not supported yet) |
| POST | `/api/me/password` | `{ currentPassword, password (or newPassword), confirmPassword }`. Signs out other sessions |
| GET / POST | `/api/me/properties` | Address, UK postcode, property type, EPC number |
| PATCH / DELETE | `/api/me/properties/:id` | Editing the address or EPC number resets "verified" |
| GET | `/api/me/billing` | Plan, renewal date, card on file (brand, last 4, expiry), invoices |
| POST | `/api/me/billing/subscribe` | `{ plan: "PRIORITY" }` returns a Stripe Checkout URL |
| POST | `/api/me/billing/portal` | Stripe Customer Portal for changing the card, adding a backup method, or cancelling |

### Admin (staff, with ★ = ADMIN only)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/dashboard` | New today, active, overdue tasks, revenue MTD★, avg completion, compliance, team workload, projects by status, revenue trend★, priority queue |
| GET | `/api/admin/projects?status=&assignedTo=&from=&to=&hasIssues=&criticalOnly=&q=&page=` | Projects Directory (paginated) |
| GET / PATCH | `/api/admin/projects/:ref` | Phase, status, priority, progress, compliance, funding, issues, due date, client notice, `coordinatorId`, `memberIds[]`. A phase change updates milestones and emails the client |
| GET / POST | `/api/admin/projects/:ref/board` | Task Board columns: Backlog, Awaiting Client, Assessment, Design, Coordination, QA, Done |
| PATCH / DELETE | `/api/admin/tasks/:id` | Edit, or move with `{ column, position }` |
| PATCH / DELETE | `/api/admin/deliverables/:id` | Attach a project document and mark it AVAILABLE |
| GET | `/api/admin/staff` | Active staff for assignment pickers |
| ★ GET / POST | `/api/admin/services` | Services Management and Create Service (tiers with deliverables, add-ons, milestones, active toggle) |
| ★ GET / PUT / PATCH / DELETE | `/api/admin/services/:id` | Services that have orders are deactivated instead of deleted |
| ★ POST | `/api/admin/uploads` | Presigned upload for service images → `{ publicUrl }` served from `/api/media/…` |
| ★ GET | `/api/admin/users?role=&status=&q=&staffOnly=true` | User Directory + pending invites |
| ★ POST | `/api/admin/users/invite` | `{ email, role, canViewAllProjects, projectIds[] }` sends a 7-day invite email |
| ★ GET / PATCH | `/api/admin/users/:id` | Role, suspend, "View all projects". Keeps at least one active admin |
| ★ POST | `/api/admin/users/:id/impersonate` | Sign in as a non-admin user for up to 1 hour |
| ★ GET | `/api/admin/settings/integrations` | Health of Stripe, S3 and SendGrid |
| ★ GET | `/api/admin/email-templates` | |
| ★ GET / PUT / DELETE | `/api/admin/email-templates/:key` | Save / reset to default. Keys: `project_update`, `invite`, `password_reset`, `order_confirmation` |
| ★ POST | `/api/admin/email-templates/:key/preview` | Renders `{ subject, html }` with sample data |
| ★ GET / POST, PATCH | `/api/admin/discount-codes`, `/:id` | |

### Files
| Method | Path | Notes |
|---|---|---|
| PUT / GET | `/api/uploads/local?token=` | Development stand-in for S3 presigned URLs (only when `S3_BUCKET` is unset) |
| GET | `/api/media/services/…`, `/api/media/avatars/…` | Public images (service photos, profile pictures) |

## Not done yet

- **Live chat:** chat polls every 10 seconds. Add Pusher or Ably if you need real-time.
- **Email changes:** changing a user's email isn't supported yet; it needs a verification flow.
- **Stripe products:** create the £29/mo Priority price in Stripe and set `STRIPE_PRICE_PRIORITY`. Enterprise is "Contact Sales".
- **Admin service editing UI:** the API supports full edits (`PUT /api/admin/services/:id`); the console currently has Create and the Active toggle.
- **Abandoned uploads:** `purgeAbandonedUploads()` in `services/documents.ts` removes unconfirmed uploads older than a day — call it from a daily cron.
