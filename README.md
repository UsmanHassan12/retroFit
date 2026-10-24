# Retrofit Portal

Marketplace, client portal and admin console for **RetrofitPortal.co.uk**. Built by Bit Technologies for StepSoft from the Retrofit Figma design.

**Stack:** Next.js 16 (App Router, Turbopack, React 19.2) · TypeScript (strict) · Tailwind CSS v4 · Zod 4 · lucide-react

## Getting started

```bash
npm install
cp .env.example .env.local   # then set SESSION_SECRET
npm run dev                  # http://localhost:3000
```

| Script              | What it does                     |
| ------------------- | -------------------------------- |
| `npm run dev`       | Dev server (Turbopack)           |
| `npm run build`     | Production build                 |
| `npm run lint`      | ESLint (next/core-web-vitals)    |
| `npm run typecheck` | `tsc --noEmit`                   |
| `npm run format`    | Prettier with Tailwind class sorting |

### Demo sign-in

Auth is a signed-cookie placeholder until the real identity provider is connected (see `src/lib/auth`).

- **Any email and password** signs you in as a **client**, which opens `/dashboard`.
- An email **starting with `admin`** (for example `admin@stepsoft.co.uk`) opens the **admin console** at `/admin`.
- Discount codes at checkout: `RETRO2026` (10%) and `WELCOME5` (5%).

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
src/
├─ app/                      # Routing only. Thin pages that compose features.
│  ├─ (marketing)/           # Public site: header + footer, statically rendered
│  ├─ (auth)/                # Split-screen auth pages
│  ├─ (client)/dashboard/    # Client portal (requireSession)
│  ├─ (admin)/admin/         # Staff console (requireStaff)
│  ├─ layout.tsx             # Fonts, metadata, globals
│  └─ globals.css            # Tailwind v4 + design tokens (@theme)
├─ components/
│  ├─ brand/                 # Logo, LogoMark, social icons (SVG from Figma)
│  ├─ ui/                    # Design-system primitives: Button, Input, Badge, Card, Table, Tabs…
│  ├─ layout/                # Site header/footer, blueprint grid sections
│  └─ dashboard/             # Dashboard shell: sidebar, topbar, stat cards
├─ features/                 # Domain modules (components + data + actions + types)
│  ├─ marketing/  services/  checkout/  auth/
│  ├─ projects/   billing/   account/   admin/
├─ lib/                      # utils, formatting, site config, auth (session/guards)
└─ proxy.ts                  # Next 16 proxy (was middleware): route protection
```

**Conventions**

- **Server Components by default.** `"use client"` is used only where there's interactivity (filters, tabs, pricing panel, chat, forms).
- **Data access goes through `features/*/queries.ts`**, which are async functions over seed data today. Swap their bodies for API calls and the pages don't change.
- **Mutations are Server Actions** (`features/*/actions.ts`) validated with Zod. Prices are always recomputed on the server; the browser is never trusted.
- **Auth is two-layered.** `proxy.ts` does a fast optimistic redirect, and `lib/auth/guards.ts` verifies the signed session in layouts and pages.
- **State lives in the URL** for filters, tiers and add-ons, so every screen is shareable and server-rendered.
- **Design tokens** (colours, shadows, fonts) are defined once in `globals.css` under `@theme` and used as Tailwind classes (`bg-navy`, `text-brand`, `shadow-card`, `bg-brand-gradient`).

## Brand assets

- `public/brand/`: logo mark (brand, white, reversed) and horizontal lockup (SVG).
- `src/app/icon.svg`: favicon.
- `public/images/`: photography exported from Figma as optimised WebP.
- `public/logos/`: partner logo strip (placeholders from the design; replace with real accreditation logos).

## Next steps (backend)

1. Replace `lib/auth/session.ts` with the real auth provider (Auth.js, Better Auth or the API's JWT).
2. Point `features/*/queries.ts` at the API.
3. Connect Stripe Checkout / PayPal in `features/checkout/actions.ts` (`placeOrder`).
4. Add file storage (S3) for document uploads and realtime chat (WebSocket + WhatsApp bridge).
