# Deploying to Render (staging / client demo)

`render.yaml` in the project root is a Render **Blueprint**. It creates:

| Resource | Plan | Notes |
| --- | --- | --- |
| `retrofit-db` PostgreSQL 16 | Free | Expires 30 days after creation (Render's free-plan rule). |
| `retrofit-portal` web service | Free | Sleeps after 15 minutes without visits; the first visit after that takes about a minute. |

The site runs with `DEMO_MODE=true`:

- card payments succeed instantly without Stripe, and a banner says payments are simulated;
- uploaded files are stored on the server's disk and **are lost on every redeploy or restart**;
- emails (password resets, invites, notifications) are written to the service logs instead of being sent.

## 1. Push the code

Commit everything, including `render.yaml` and both folders in `prisma/migrations`
(`…_init` and `…_notifications`), and push to the `main` branch on GitHub.
`.env` files and `.uploads/` are ignored and must not be pushed.

## 2. Create the Blueprint

1. Render dashboard → **New** → **Blueprint**.
2. Connect GitHub if asked, and pick the repository.
3. Render shows the database and the web service from `render.yaml`. Click **Apply**.

The first build runs `npm ci`, then `prisma migrate deploy` (creates the tables), then `next build`.
It takes several minutes. When it shows **Live**, the address is on the service page
(for example `https://retrofit-portal.onrender.com`). The app uses that address for links automatically.

## 3. Load the catalogue and demo accounts (once)

The database starts empty: no services and no admin. Load them from your computer:

1. Render → `retrofit-db` → **Connect** → copy the **External Database URL**.
2. In PowerShell, in the project folder:

   ```powershell
   $env:DATABASE_URL = "<External Database URL>?sslmode=require"
   $env:SEED_ADMIN_PASSWORD = "<a strong password for the demo admin>"
   npm run db:seed
   Remove-Item Env:DATABASE_URL, Env:SEED_ADMIN_PASSWORD
   ```

   The seed **wipes and refills** the database. Run it only to set up or reset the demo.

3. Sign in at `<your Render address>/login` as `admin@retrofitportal.co.uk` with that password.

The demo client and partner accounts use the password shown at the top of `prisma/seed.ts`.
Anyone with the address can try them, so change or remove them before sharing widely.

The seeded sample documents are stored on your computer, not on Render, so downloading them
on the demo shows "not found". Files uploaded on the demo itself work until the next redeploy.

## 4. Later deploys

Every push to `main` redeploys automatically and applies any new migrations.
If a migration fails, the build stops and the previous version stays live.

## What the free plan doesn't run

- **Hourly billing job** (`/api/cron/billing`: weekly invoices, reminders, holds). Render cron jobs
  aren't free. On a paid plan add a cron job that runs every hour:
  `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your address>/api/cron/billing`.
- **Persistent uploads**: needs an S3 bucket (`S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).

## Going to real production

Remove `DEMO_MODE`, and set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the S3 variables,
`SENDGRID_API_KEY` and `EMAIL_FROM`. Use paid plans for the web service and database,
add the billing cron job, and don't run the demo seed.
