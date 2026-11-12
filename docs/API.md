# Retrofit Portal: Backend

Backend for **RetrofitPortal.co.uk**, built from the Figma design (Services → Review Order → Payment → Client Dashboard → Admin). It lives inside the Next.js app: route handlers in `src/app/api`, business logic in `src/server`.

**Stack:** Next.js 16 (App Router route handlers + Server Actions) · Prisma 6 · PostgreSQL 16 · Zod 4 · JWT session cookie (HS256 via WebCrypto, no extra dependency) · scrypt password hashing (Node built-in) · Stripe · AWS S3 · SendGrid

## Getting started

```bash
cp .env.example .env               # set DATABASE_URL and AUTH_SECRET (32+ characters)
npm install                        # also runs `prisma generate`
npm run db:up                      # Postgres 16 in Docker (or point DATABASE_URL at your own)
npm run db:migrate                 # applies prisma/migrations
npm run db:seed                    # catalogue, settings and demo data (wipes existing data)
npm run dev                        # http://localhost:3000/api/health
```

**Seeded accounts.** The admin uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (defaults `admin@retrofitportal.co.uk` / `Admin123!`). All other demo accounts use the password `Retrofit123!`:
- `sarah.jenkins@example.com` is a **Basic** customer (homeowner, pays by card). She owns **RET-2026-0042**, a Retrofit Assessment at 124 Oakwood Crescent with a site visit booked, plus four more projects.
- `ops@acme-insulation.example` is a **Premium Partner on weekly invoices** (10% off, 15% on Coordination, £5,000 credit limit). Last week's invoice is issued and this week's bookings are waiting for Friday's run.
- `retrofit@northern-homes.example` is a **Premium Partner paying in advance** (12% off) with account credit.
- `hello@bright-lofts.example` has a partner application waiting for admin approval.
- `john.hopkins@retrofitportal.co.uk` is a coordinator, `mike.ross@…` and `rob.clarke@…` are assessors with visit slots in the NW and M postcode areas, `jane.doe@…` and `marie.dubois@…` are designers.
- Discount codes `RETRO2026` (10%) and `WELCOME5` (5%) apply to Basic customers; a partner discount and a code never stack.

**Running without third-party keys:**
- **Stripe:** if `STRIPE_SECRET_KEY` is empty and you're not in production, card payments, credit top-ups, invoice payments and the partner subscription succeed straight away, so every flow works locally.
- **SendGrid:** if `SENDGRID_API_KEY` is empty, emails (reset links, invites, confirmations) are printed to the server console.
- **S3:** if `S3_BUCKET` is empty, files are stored in `./.uploads` behind short-lived HMAC-signed URLs (`/api/uploads/local`). Production requires S3.

**Stripe webhook (local):** `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Put the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`. Events handled: `checkout.session.completed` / `async_payment_succeeded` (bookings, credit top-ups, invoice payments, partner subscriptions), `customer.subscription.updated` / `deleted`, `invoice.paid` (subscription receipts), `charge.refunded`.

**Scheduled job:** set `CRON_SECRET` and call `GET /api/cron/billing` with `Authorization: Bearer <CRON_SECRET>` **every hour** (`vercel.json` does this on Vercel). It creates weekly invoices at the Friday 17:00 UK cut-off, sends reminders, marks unpaid invoices overdue and places holds. Every step is idempotent, so hourly runs catch up after downtime and follow BST/GMT. Admins can also run it from `POST /api/admin/billing/run`.

## Code layout

```
prisma/schema.prisma        data model        prisma/seed.ts   demo data
src/server/
  db.ts env.ts http.ts errors.ts domain.ts
  auth/          jwt.ts · password.ts · session.ts · permissions.ts
  integrations/  stripe.ts · storage.ts (S3 / local) · email.ts (SendGrid / console) · template.ts
  rules/         pure functions, unit-tested: pricing · calendar (UK time, working days, billing weeks) ·
                 conditions (intake/document rules) · workflow (status machine, cancellation) · csv
  settings-schema.ts   commercial settings and their draft defaults
  services/      auth · catalog · intake · orders · workflow · projects · tasks · documents · deliverables ·
                 availability · partners · customers · credit · holds · invoices · billing · billing-cycle ·
                 settings · messages · account · admin · references · media · audit
prisma/data/catalogue.ts    the 11 StepSoft services, stages, questions, document lists, bundle, bank holidays
src/app/api/**   thin route handlers, one per endpoint below
tests/           node:test unit tests (npm test)
```

Pages don't call the API over HTTP: Server Components use `features/*/queries.ts` and Server Actions use `features/*/actions.ts`, both of which call the same `src/server/services`. The browser uses the JSON API for chat, uploads and the task board.

## Roles & access

| Role | Can do |
|---|---|
| `CLIENT` | Buy services, see **own** projects, chat, upload docs, manage profile, properties and billing. A client is **Basic**, or **Premium Partner** while their partner profile is ACTIVE |
| `ASSESSOR`, `DESIGNER`, `COORDINATOR` | Admin area for projects they coordinate or are a member of (or all, with "View all projects"); task board; deliverables |
| `COORDINATOR` | Also change a project's coordinator and team |
| `ADMIN` | Everything, plus services, users and invites, impersonation, settings, email templates, discount codes, revenue |

The session is an httpOnly cookie, `rp_session`, holding a signed HS256 JWT (7 days; 1 hour while impersonating). `proxy.ts` verifies it for fast page redirects. Every API handler and page re-loads the user from the database, so suspending a user, changing their role or changing their password (`sessionVersion`) revokes existing sessions immediately. Clients get a **404** for other people's projects, not a 403. Sensitive admin actions are written to `AuditLog`.

## Commercial rules (draft catalogue, 11 Nov 2026)

Everything below is **data, not code**: catalogue rows, `IntakeQuestion` / `ServiceDocumentRequirement` rows and the `Setting` table. When StepSoft's final sheet arrives, update data (admin console, the API below, or `prisma/data/catalogue.ts` + reseed on a fresh database).

**Customer tiers.** One list price per service unit. *Basic* pays list price by card upfront; the project starts once payment succeeds. *Premium Partner* (£199/month + VAT placeholder) gets a per-partner discount (default 10%, allowed 0–30%, optional per-service override), the fast-track turnaround (`fastTrackDays`, 0 = same day when booked before 12:00 UK) and the priority queue, and pays either from **prepaid credit** or on a **weekly invoice**, chosen per partner by admin. Partner onboarding: apply → admin approves terms (OFFERED) → partner e-signs the agreement (name, time, IP, version stored) → subscription starts → ACTIVE.

**Pricing** (server only, integer pence, every figure snapshotted on the order line): list price × quantity (or the bundle share) → partner discount *or* discount code, whichever is larger → add-ons (Express +30% for Basic, extra visit £150, travel 45p/mile beyond 30) → VAT 20%. Order totals are the sum of lines, so weekly invoices add up to the receipts.

**Payment.**
- Basic: card (Stripe Checkout). VAT receipt issued on payment.
- Partner, pay in advance: deducted from credit at confirmation (VAT receipt); if credit is short, pay the difference by card (credit is held while the card payment runs and returned if it's cancelled). Top-ups by card or bank transfer (admin records it) produce a receipt.
- Partner, weekly: confirmed straight away, subject to the credit limit (unbilled + unpaid). Every Friday 17:00 UK one VAT invoice covers that week's bookings (setting `billing.invoiceBasis`: booked / started / delivered), due the following Friday 18:00. Reminders Wednesday and the due morning. Unpaid at the deadline → OVERDUE and the account goes **on hold**.

**Account hold.** No new bookings, open projects move to ON_HOLD (setting `billing.holdPausesWork`), task changes are blocked and deliverable downloads are withheld. Paying in full lifts an automatic hold; admins can lift any hold with a reason. Turnaround clocks restart when a hold lifts.

**Projects.** One project per order line. Status model: AWAITING_PAYMENT → AWAITING_INFO → SCHEDULED → IN_PROGRESS → IN_QA → DELIVERED → (REVISION →) COMPLETED, plus ON_HOLD and CANCELLED (`src/server/rules/workflow.ts`). Each service's stages become the client's milestones; a stage can move the status (e.g. "QA review" → IN_QA). A project waits in AWAITING_INFO until required intake answers and BEFORE_START documents are in and, for visit services, a visit is booked; then it moves on by itself. **Due date** = (intake complete or site visit, whichever is later) + standard or fast-track working days, skipping bank holidays. Deliverables go Initial → Revised → Final; 2 revision rounds are included, extra rounds are quoted. **Cancellation:** free before a visit is booked or work starts, 50% once work starts or within 24h of a visit, 100% once delivered; failed visits (no access) are charged £150. Refunds go back to the card (Basic), to credit (advance partners), or as a credit note (weekly partners, if already invoiced).

**Intake.** Common steps 1–4 (customer, address with UPRN, property basics, occupant) are user/property fields; steps 5–7 (funding scheme, installer, measures) and each service's questions are `IntakeQuestion` rows with conditions such as `{ "key": "scheme", "op": "in", "value": ["ECO4","GBIS"] }` or `{ "key": "$services", "op": "notIncludes", "value": "RA" }`. Answers are validated with a Zod schema built from the rows. Step 8 is the visit slot (`Availability` per assessor, postcode area and AM/PM window), step 9 the service's document list, step 10 consent (terms version and timestamp on the order).

## API

All responses are JSON. Errors look like `{ error: { code, message, details? } }` (`details` holds per-field messages for validation errors). Money is always in **pence** (`*Pence`); percentages are basis points (`*Bps`, 1000 = 10%).

### Health & cron
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Database check and which integrations are configured |
| GET / POST | `/api/cron/billing` | `Authorization: Bearer <CRON_SECRET>`. Weekly invoices, reminders, overdue holds, stale-upload clean-up. Idempotent; run hourly |

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{ email, password, confirmPassword, firstName?, lastName?, companyName?, customerType? }` creates a Basic CLIENT and signs them in |
| POST | `/api/auth/login` | `{ email, password }`. Locks the account for 15 min after 5 failed attempts |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | Current user, `tier` (BASIC / PARTNER) and `impersonating` |
| POST | `/api/auth/forgot-password`, `/api/auth/reset-password` | Always 200 / 1-hour token |
| GET / POST | `/api/auth/accept-invite` | Staff invites |
| POST | `/api/auth/impersonation/stop` | |

### Catalogue & booking form (public)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/services?q=&category=ASSESSMENT,CALCULATIONS&budget=under-100\|100-300\|300-plus` | Cards: code, list price per unit, Basic and partner turnaround |
| GET | `/api/services/:slugOrCode` | Detail: pricing, add-ons, stages (timeline), deliverables, document list, questions |
| GET | `/api/bundles` | Bundles, e.g. Assessment + Design + Coordination £850 per property |
| GET | `/api/plans` | Basic vs Premium Partner with live values |
| GET | `/api/intake?services=RA,RD&bundle=` | The booking form: steps, enums (property types, tenures, schemes, measures), common questions, each service's questions and documents, consent items |
| GET | `/api/availability?postcode=NW10 6RF&from=&to=` | Free AM / PM visit windows from tomorrow |

### Orders & checkout
| Method | Path | Notes |
|---|---|---|
| POST | `/api/orders/quote` | Same body as below without `consent`. Signed out = Basic prices. → `{ tier, paymentMethods, lines[], totals, missing[] }` |
| POST | `/api/orders` | `{ lines: [{ serviceId, propertyId? \| property?, quantity, addons: [{ key, quantity? }], answers, availabilityId? }], bundleId?, answers, discountCode?, consent: { acceptTerms: true, gdprConsent, shareDataConsent } }` → DRAFT order + `missing` intake answers. Bulk: one line per property; bundles: one line per property with `bundleId` |
| GET | `/api/orders`, `/api/orders/:idOrRef` | |
| DELETE | `/api/orders/:id` | Cancel an unpaid order (held credit is returned) |
| POST | `/api/orders/:id/checkout` | `{ method?: CARD \| CREDIT \| CREDIT_AND_CARD \| WEEKLY_INVOICE }` → `{ url, paid }` |
| POST | `/api/webhooks/stripe` | Confirms orders, top-ups, invoice payments and subscriptions. Idempotent |

### Projects (client and staff)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard` | Client numbers incl. projects awaiting information |
| GET | `/api/projects?status=all\|active\|completed&q=` | |
| GET | `/api/projects/:ref` | Status, current stage, milestones (client-visible only for clients), what's missing, document checklist, next visit, revisions |
| GET | `/api/projects/:ref/requirements` | Missing answers and the document checklist |
| PUT | `/api/projects/:ref/intake` | `{ orderAnswers?, answers? }` complete the booking details; the project moves on when ready |
| GET / POST | `/api/projects/:ref/visits` | List / book or re-book: `{ availabilityId }` |
| POST | `/api/projects/:ref/documents` | `{ fileName, mimeType, sizeBytes, requirementKey? }` (PDF, JPG, PNG, DOCX, XLSX ≤ 25 MB; a requirement can narrow it) → presigned upload, then `/confirm` |
| GET / DELETE | `/api/projects/:ref/documents/:docId`, POST `…/confirm` | |
| GET / POST | `/api/projects/:ref/messages?after=ISO`, `/tasks`, `/timeline` | |
| GET | `/api/projects/:ref/deliverables`, `…/:id/download?version=N` | Downloads are blocked while the account is on hold |
| POST | `/api/projects/:ref/revisions` | `{ note }` on a DELIVERED project. Included rounds start at once; extra rounds are quoted |
| GET / POST | `/api/projects/:ref/cancel` | Preview `{ percent, reason, feePence, refundPence, refundTo }` / cancel `{ reason, expectedFeePence? }` (client or admin) |

### Account, partner & billing
| Method | Path | Notes |
|---|---|---|
| GET / PATCH | `/api/me/profile` | Also `companyName`, `customerType` |
| GET / POST, PATCH / DELETE | `/api/me/properties`, `/:id` | Address, UPRN, property basics, tenure, occupant contact and access notes |
| POST | `/api/me/properties/import` | CSV (text/csv or `{ csv }`): `reference, uprn, address_line_1, address_line_2, city, postcode, property_type, built_form, build_year, storeys, bedrooms, tenure, occupant_name, occupant_phone, access_notes` → per-row results; existing addresses are reused |
| GET | `/api/me/billing` | Tier, partner status and next step, credit balance, unbilled + unpaid, hold, invoices |
| POST | `/api/me/billing/portal` | Stripe customer portal (cards) |
| GET / POST | `/api/me/credit`, `/api/me/credit/topup` | Statement / `{ amountPence }` card top-up (minimum £500 placeholder) |
| GET | `/api/invoices/:id`, `/api/invoices/:id/document` | JSON / printable VAT invoice (seller name, address, VAT number, number, date, VAT 20%) |
| POST | `/api/invoices/:id/pay` | Pay an open invoice by card |
| GET | `/api/partner` | Partner status and `nextStep` (APPLY, WAIT_FOR_APPROVAL, SIGN_AGREEMENT, SUBSCRIBE…) |
| POST | `/api/partner/apply` | `{ companyName, customerType, companyNumber?, vatNumber?, trustmarkLicence?, note? }` |
| GET / POST | `/api/partner/agreement` | The agreement with your terms / e-sign `{ fullName, accept: true, version }` |
| POST / DELETE | `/api/partner/subscription` | Start the subscription (activates the account) / give notice |

### Admin (staff; ★ = ADMIN only)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/dashboard` | Includes projects awaiting information and accounts on hold★; revenue is confirmed bookings net of VAT |
| GET | `/api/admin/projects?status=&partnerOnly=true&…` | `status` takes all / active / completed, a workflow status or a health value. Premium Partner work sorts first |
| GET / PATCH | `/api/admin/projects/:ref` | `status` (rules enforced; `force` for admins), `health`, priority, due date, notes, issues, team |
| POST | `/api/admin/projects/:ref/stage` | Next stage, or `{ position }` |
| GET / POST, PATCH / DELETE | `/api/admin/projects/:ref/board`, `/api/admin/tasks/:id` | Task board (blocked while ON_HOLD, except admins) |
| PATCH / DELETE | `/api/admin/deliverables/:id` | |
| POST | `/api/admin/deliverables/:id/versions` | `{ documentId, label?: INITIAL \| REVISED \| FINAL, note? }` |
| PATCH | `/api/admin/revisions/:id` | `{ accept, pricePence? }` extra revision rounds (accepted ones are invoiced) |
| PATCH | `/api/admin/visits/:id` | `{ status: COMPLETED \| NO_ACCESS \| CANCELLED, notes? }`. NO_ACCESS charges the failed-visit fee |
| GET / POST, PATCH / DELETE | `/api/admin/availability`, `/:id` | Publish visit capacity `{ assessorId, region, from, to, weekdays?, windows?, capacity? }` (admins, coordinators) |
| ★ GET, GET / PATCH | `/api/admin/partners?status=`, `/:id` | Partners with credit, exposure and holds; change terms or status |
| ★ POST | `/api/admin/partners/:id/offer` | Approve: `{ discountBps?, paymentMode, creditLimitPence? }` |
| ★ PUT | `/api/admin/partners/:id/discounts` | `[{ serviceId, discountBps \| null }]` |
| ★ GET / POST | `/api/admin/users/:id/credit` | Statement / bank-transfer top-up or adjustment `{ type, amountPence, note }` |
| ★ GET / POST | `/api/admin/users/:id/hold`, GET `/api/admin/holds`, POST `/api/admin/holds/:id/lift` | Manual holds; lifting needs `{ reason }` |
| ★ GET | `/api/admin/invoices?status=&kind=&userId=` | |
| ★ POST | `/api/admin/invoices/:id/paid`, `/:id/void` | Record a bank transfer `{ via, note }` (lifts automatic holds) / void `{ reason }` |
| ★ POST | `/api/admin/billing/run` | Run the billing job now |
| ★ GET / POST, GET / PUT / PATCH / DELETE | `/api/admin/services`, `/:id` | Full service definition: code, pricing, turnaround, stages, add-ons, documents (with conditions), questions, deliverables |
| ★ GET / POST, PUT | `/api/admin/bundles`, `/:id` | |
| ★ GET / PUT | `/api/admin/intake-questions` | Common questions (steps 5–7) |
| ★ GET, PUT | `/api/admin/settings/commercial`, `/:section` | Sections: `vat`, `partner`, `billing`, `booking`, `cancellation`, `revisions`, `seller` (partial bodies merge) |
| ★ GET / PUT | `/api/admin/bank-holidays` | `[{ date, name }]` replaces the years given |
| ★ … | users, invites, impersonation, integrations, email templates, discount codes, uploads | As before. New email templates: `invoice_issued`, `invoice_reminder`, `account_hold`, `hold_lifted`, `partner_application`, `partner_offer`, `partner_activated`, `credit_receipt` |

### Files
| Method | Path | Notes |
|---|---|---|
| PUT / GET | `/api/uploads/local?token=` | Development stand-in for S3 presigned URLs |
| GET | `/api/media/…` | Public images |

## Open decisions (data or settings, no code change)

Final prices, units and turnaround for the 11 services · partner fee and whether there's more than one level · default discount, range and excluded services (`Service.discountable`) · which services get same-day · weekly invoice basis (`billing.invoiceBasis`) · cut-off, deadline and grace period · whether a hold pauses work (`billing.holdPausesWork`) · payment methods for partners · cancellation and failed-visit charges · visit areas and travel · StepSoft's VAT number and address (`seller`) · extra services or bundles · AI-assisted documentation (out of scope).

## Not done yet

- **Booking UI for bulk / bundles:** the API takes many properties and bundles; the storefront checkout books one service for one property. A partner bulk-booking screen (CSV upload → one order) is the next UI piece.
- **Admin screens for partners, invoices, holds, availability and settings:** the API is complete; the console pages still need building.
- **Address lookup (step 2):** store the UPRN from Ideal Postcodes or getAddress.io; the lookup itself isn't wired (needs an API key).
- **GoCardless / Direct Debit** and **PayPal** for one-off checkout aren't integrated (Stripe only).
- **Credit notes** for cancelled, already-invoiced weekly bookings are recorded as negative charges; reconcile them with the partner's next payment.
- **Live chat** still polls every 10 seconds; **email changes** aren't supported.
