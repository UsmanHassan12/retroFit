# Retrofit Portal

Marketplace, client portal and admin console for **RetrofitPortal.co.uk**. Built by Bit Technologies for StepSoft from the Retrofit Figma design.

**Stack:** Next.js 16 (App Router, route handlers, Server Actions, React 19.2) · TypeScript (strict) · Tailwind CSS v4 · Prisma 6 · PostgreSQL 16 · Zod 4 · JWT session cookie (HS256, WebCrypto) · scrypt passwords · Stripe · AWS S3 · SendGrid

## Getting started

You need **Node 20.9+** and **PostgreSQL 16** (Docker Desktop with `npm run db:up`, or any local/hosted Postgres).

```bash
cp .env.example .env               # set DATABASE_URL and AUTH_SECRET (32+ chars)
npm install                        # also runs `prisma generate`
npm run db:up                      # optional: Postgres 16 in Docker on :5432
npm run db:migrate -- --name init  # create the tables
npm run db:seed                    # demo data from the Figma screens (wipes existing data)
npm run dev                        # http://localhost:3000 — health check at /api/health
```

Prisma reads `.env` (not `.env.local`), so keep `DATABASE_URL` in `.env`.

| Script               | What it does                                         |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Dev server (Turbopack)                               |
| `npm run build`      | Production build                                     |
| `npm run lint`       | ESLint (next/core-web-vitals)                        |
| `npm run typecheck`  | `tsc --noEmit`                                       |
| `npm test`           | Unit tests: pricing, JWT, passwords, email templates |
| `npm run db:migrate` | Create / apply a migration in development            |
| `npm run db:deploy`  | Apply migrations in production                       |
| `npm run db:seed`    | Reset and load demo data                             |
| `npm run db:studio`  | Browse the database in Prisma Studio                 |

### Demo accounts (after `npm run db:seed`)

| Who | Email | Password |
| --- | --- | --- |
| Admin | `admin@retrofitportal.co.uk` (or `SEED_ADMIN_EMAIL`) | `Admin123!` (or `SEED_ADMIN_PASSWORD`) |
| Client | `sarah.jenkins@example.com` (owns RET-2026-0042 + 6 more) | `Retrofit123!` |
| Coordinator | `john.hopkins@retrofitportal.co.uk` | `Retrofit123!` |
| Assessor / designers | `mike.ross@…`, `jane.doe@…`, `rob.clarke@…`, `marie.dubois@…`, `aron.patel@…` | `Retrofit123!` |

Discount codes: `RETRO2024` / `RETRO2026` (10%), `WELCOME5` (5%). Sarah is on the Priority plan, so she already gets 15% off and codes below that don't apply.

### Running without third-party keys

- **Stripe** — leave `STRIPE_SECRET_KEY` empty in development and "Complete Purchase" marks the order paid immediately and creates the project. With keys, it redirects to Stripe Checkout and the webhook (`/api/webhooks/stripe`) creates the project. Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and put the `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
- **S3** — leave `S3_BUCKET` empty and uploads are stored in `./.uploads` behind short-lived signed URLs (`/api/uploads/local`). Production requires S3.
- **SendGrid** — leave `SENDGRID_API_KEY` empty and emails (reset links, invites, order confirmations) are printed in the terminal running `npm run dev`.

## Routes

| Area      | Route                                          | Screen (Figma)                                            |
| --------- | ---------------------------------------------- | --------------------------------------------------------- |
| Marketing | `/`                                            | Landing Page                                              |
|           | `/services`                                    | Services listing (search, category and budget filters)    |
|           | `/services/[slug]`                             | Service detail: Overview / Included / Timeline / Compliance |
| Checkout  | `/checkout/[slug]?tier=&addons=`               | Review Order                                              |
|           | `/checkout/[slug]/payment`                     | Complete Order (receipt)                                  |
|           | `/checkout/confirmation`                       | Order confirmed                                           |
| Auth      | `/login`, `/signup`, `/forgot-password`        | #1 Login / Sign Up                                        |
|           | `/reset-password?token=`, `/accept-invite?token=` | Emailed links: new password, staff invitation          |
| Client    | `/dashboard`                                   | Client dashboard                                          |
|           | `/dashboard/projects`                          | My Projects                                               |
|           | `/dashboard/projects/[id]` (+ `/documents`, `/messages`, `/timeline`, `/deliverables`) | Project detail tabs |
|           | `/dashboard/profile`                           | Profile & Property                                        |
|           | `/dashboard/billing`, `/dashboard/billing/plans` | Billing & Plans                                         |
| Admin     | `/admin`                                       | Admin dashboard (charts and priority queue)               |
|           | `/admin/projects`, `/admin/projects/[id]`      | Projects directory and task board                         |
|           | `/admin/services`, `/admin/services/new`       | Services management                                       |
|           | `/admin/users`, `/admin/users/invite`          | User directory and invite staff                           |
|           | `/admin/settings`                              | Platform settings                                         |

## Architecture

```
prisma/
├─ schema.prisma             # Data model (users, catalogue, orders, projects, tasks, docs, chat…)
└─ seed.ts                   # Demo data matching the Figma screens
src/
├─ app/                      # Routing only. Thin pages that compose features.
│  ├─ (marketing)/           # Public site + checkout
│  ├─ (auth)/                # Login, sign up, reset password, accept invite
│  ├─ (client)/dashboard/    # Client portal (requireSession)
│  ├─ (admin)/admin/         # Staff console (requireStaff / requireAdmin)
│  └─ api/                   # JSON API — thin route handlers over src/server/services
├─ server/                   # Backend (server-only)
│  ├─ db.ts  env.ts  http.ts  errors.ts  domain.ts
│  ├─ auth/                  # jwt.ts (HS256), password.ts (scrypt), session.ts, permissions.ts
│  ├─ integrations/          # stripe.ts, storage.ts (S3 / local), email.ts (SendGrid / console)
│  └─ services/              # Business logic: auth, catalog, orders, pricing, projects, tasks,
│                            # documents, messages, deliverables, account, billing, admin
├─ features/                 # UI modules: components + queries.ts (adapters) + actions.ts
├─ components/               # Design system: brand, ui, layout, dashboard
├─ lib/                      # utils, formatting, auth guards, browser API client
└─ proxy.ts                  # Next 16 proxy: verifies the session JWT and redirects early
tests/                       # node:test unit tests (npm test)
```

**How a request flows**

- **Pages** (Server Components) call `features/*/queries.ts`, which call `src/server/services/*` directly — no HTTP round-trip — and map the results to view models.
- **Forms** use Server Actions (`features/*/actions.ts`) that validate with Zod in the service layer and return field errors.
- **The JSON API** (`src/app/api/**`) exposes the same services for the browser (chat, uploads, task board) and for other clients. Every handler is wrapped in `handle()`, so errors always look like `{ error: { code, message, details? } }`.
- **Auth** is an httpOnly `rp_session` cookie holding a signed HS256 JWT. `proxy.ts` checks the signature for fast redirects; `getCurrentUser()` re-loads the user on every request, so suspensions, role changes and password changes (via `sessionVersion`) take effect immediately.
- **Access control** lives in `server/auth/permissions.ts`. Clients only see their own projects (others are a 404); staff see projects they coordinate or are members of, or everything with "View all projects"; admins see everything.
- **Money is integer pence** everywhere on the server. Prices are always recomputed server-side; the browser is never trusted.
- **Design tokens** (colours, shadows, fonts) are defined once in `globals.css` under `@theme`.

The full API reference is in [`docs/API.md`](docs/API.md).

## Deploying

1. Provision Postgres 16 and set `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`.
2. Set Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRIORITY`), S3 (`S3_BUCKET`, `AWS_REGION`, credentials) and SendGrid (`SENDGRID_API_KEY`, `EMAIL_FROM`).
3. `npm ci && npm run db:deploy && npm run build && npm start`.
4. Point a Stripe webhook at `https://<your-domain>/api/webhooks/stripe` with `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `charge.refunded`.

## Brand assets

- `public/brand/`: logo mark (brand, white, reversed) and horizontal lockup (SVG).
- `src/app/icon.svg`: favicon.
