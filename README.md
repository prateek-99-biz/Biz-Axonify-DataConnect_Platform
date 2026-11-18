# Biz Group Customer Intelligence Platform

Internal Next.js app for customer-success teams: portfolio and client analytics from Axonify DataConnect (BigQuery), plus notes, tasks and alerts. Built for a small team (5–10 users) and a zero-cost setup: **Supabase** (Postgres + Auth, free tier) and one machine to run it.

**Status:** live on Vercel against synced BigQuery data. Includes the portfolio and Client 360, the ten quarterly review pages, the Insights pages (Client Leaderboard, Account Health, Benchmarks and Features, Max AI Usage, CSM Portfolio, Cost to Serve), and the internal pages (Internal Home, My Accounts, Alerts and Watchlist, Renewals). Salesforce data (CSM, licences, renewals) comes from a static CSV imported in Settings; there is no live Salesforce connection. Sample accounts can be loaded and removed with one button. Unattended nightly sync is not in place yet: it needs Google Cloud admin access ([docs/DATA_REFRESH.md](docs/DATA_REFRESH.md)). Open items: [TASKLIST.md](TASKLIST.md).

## Documentation
| File | For |
|---|---|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Using the dashboard: roles, menu, everyday tasks |
| [docs/DATA_REFRESH.md](docs/DATA_REFRESH.md) | Refreshing and scheduling the data, Google sign-in, Workload Identity Federation steps |
| [PROJECT_SCOPE.md](PROJECT_SCOPE.md) | What the app does, metric definitions, success criteria |
| [TASKLIST.md](TASKLIST.md) | Findings, fixes and open work |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases and what is next |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit |
| [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) | Unconfirmed inputs and decisions |
| [docs/BRANDING.md](docs/BRANDING.md) | Colour and logo rules |
| [docs/salesforce-data-request.md](docs/salesforce-data-request.md) | The CSV to request from the Salesforce owners |
| [docs/email-templates/README.md](docs/email-templates/README.md) | Supabase email templates |

## How data flows
```
BigQuery (DataConnect) ──scheduled query──▶ small summary tables
        │  daily: `npm run sync`  (or admin “Refresh data” button)
        ▼
Supabase Postgres (SyncClient, SyncClientPeriod, SyncRun) ──▶ pages (fast, no BigQuery calls per click)
```
Pages show an “as of” time = last successful sync. A failed sync keeps the previous data. Data is at most as fresh as the last sync (daily by default).

## Quick start (local, no accounts)
```bash
npm install
cp .env.example .env     # for a quick look keep DATA_ADAPTER=mock and AUTH_DEV_LOGIN=true
# needs any PostgreSQL; put its URL in DATABASE_URL and DIRECT_URL
npx prisma migrate deploy
npm run db:seed
npm run dev              # http://localhost:3000 → "Development login"
```

## Real setup (Supabase, free tier)
1. Create a Supabase project. Copy into `.env`: `DATABASE_URL` and `DIRECT_URL` (both the session pooler, port 5432, for a machine that stays running; see `.env.example`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Vercel uses the transaction pooler instead (see Hosting on Vercel).
2. Supabase dashboard → Authentication: keep public sign-ups **on** if people should use the Create an Account page (staff with a confirmed `@bizgroup.ae` address become Members; anyone else sees nothing until an admin links them to a client). Turn them off to allow invitations only. Under URL Configuration set the Site URL to the live address and add `<address>/auth/confirm` to Redirect URLs (also `http://localhost:3000/auth/confirm` for local work). Paste the three email templates from [docs/email-templates](docs/email-templates/README.md); the account links do not work without them. A free project pauses after about a week without use, and then every sign-in fails until it is restored in the dashboard.
3. Set `ADMIN_EMAILS=you@bizgroup.ae` (first sign-in of that email becomes Admin; everyone else is Member). Admins change roles in Settings.
4. `npx prisma migrate deploy && npm run db:seed`.
5. BigQuery: set `BQ_PROJECT_ID`, `BQ_DATASET` (defaults to `axonify___bizgroup_emea`), `BQ_TENANT_IDS` (the Axonify tenant ids to cover) and `GOOGLE_APPLICATION_CREDENTIALS` (service account with BigQuery Data Viewer + Job User, or `gcloud auth application-default login`). Run `npm run bq:check` to dry-run every query without reading data. A mapping file (`config/bigquery-mapping.example.json`) is only needed to override the built-in client and quarterly queries with your own summary tables.
6. Set `DATA_ADAPTER=synced`, run `npm run sync` once, then `npm run build && npm start`.
7. Refresh by hand with `npm run sync:now` (opens the Google sign-in only when it has expired), or double-click `scripts\Refresh Data.cmd`. `npm run sync:schedule` sets up a nightly Task Scheduler run, and `-Morning` adds a weekday check that opens the sign-in when needed. Details and the unattended options: [docs/DATA_REFRESH.md](docs/DATA_REFRESH.md).

`SUPABASE_SERVICE_ROLE_KEY` is needed only for Settings → Add User and Resend Link. It stays on the server and must never be given a `NEXT_PUBLIC_` name.

## Hosting on Vercel
- Every push to `main` deploys. `vercel.json` pins the server code to `bom1` (Mumbai), next to the Supabase database in ap-south-1; in the default US region each page took 2 to 4 seconds because every database call crossed the world.
- `DATABASE_URL` in Vercel (Production and Preview) is Supabase's **transaction pooler**: `...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=20`. Serverless instances start and stop often, and the transaction pooler lets them share a small number of database connections. `pgbouncer=true` turns off the prepared statements the pooler cannot keep. `connection_limit=5` rather than 1, because Fluid compute serves several requests from one instance at a time. `DIRECT_URL` stays on the session pooler (port 5432) and is only used for migrations.
- Both are stored as Secrets, so Vercel does not show them again. To change one: `npx vercel link`, then `npx vercel env update DATABASE_URL --environment production --sensitive` (it covers Preview too), then redeploy. A changed variable takes effect only on the next deployment.
- Google access for the refresh on Vercel: [docs/DATA_REFRESH.md](docs/DATA_REFRESH.md).

## Refresh button
Admins see **Refresh Data** in the top bar. It runs the same sync as the scripts, enforces a 60-second cooldown, refuses to run twice at once, and reports failures without touching existing data. In mock mode it explains there is nothing to refresh. It needs Google access on the machine serving the page, so on Vercel it will fail until the app has its own identity (see DATA_REFRESH.md).

## Roles
Admin: everything, plus Settings and Refresh. Member: analytics, notes, tasks, CSV export. Client (external): only the QBR dashboard for the one client assigned to them in Settings. Enforced server-side ([src/server/auth/rbac.ts](src/server/auth/rbac.ts)); a client user is pinned to their client regardless of URL params.

## Dashboards (`/qbr`)
The ten pages from [axonify-dashboard-spec.md](axonify-dashboard-spec.md): Homepage, Engagement, Knowledge, Content, Usage, Team Performance, Topic Deep Dive, Knowledge & Confidence Matrix, Content Delivery and Content Progression. One client and one date range are shared across pages through the URL. Staff see the same pages with internal extras (content flags and priority, data-quality notes, CSV export, a link to Client 360); client users see the clean QBR view. Dashboard data is mock-only until `npm run sync` has run against BigQuery; with `DATA_ADAPTER=synced` the pages say so instead of showing anything.

## Safety rails
- `DATA_ADAPTER=mock` throws in production; no silent fallback to mock. Unavailable sources show an explanation.
- The cookie dev login only works when `NODE_ENV!=production` and `AUTH_DEV_LOGIN=true`.
- BigQuery credentials and DB URLs are server-side only.

Checks: `npm run typecheck && npm run lint && npm test && npm run build`.
