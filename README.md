# Biz Group Customer Intelligence Platform

Internal Next.js app for customer-success teams: portfolio and client analytics from Axonify DataConnect (BigQuery), plus notes, tasks and alerts. Built for a small team (5–10 users) and a zero-cost setup: **Supabase** (Postgres + Auth, free tier) and one machine to run it.

**Status:** Phase 1 vertical slice. Runs on clearly labelled **mock data** until the BigQuery summary tables are mapped. Salesforce is not integrated. See [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md).

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
1. Create a Supabase project. Copy into `.env`: pooled `DATABASE_URL` (port 6543, `?pgbouncer=true`), `DIRECT_URL` (port 5432), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Supabase dashboard → Authentication: turn **off** public sign-ups, then add your team under Users (email + password).
3. Set `ADMIN_EMAILS=you@bizgroup.ae` (first sign-in of that email becomes Admin; everyone else is Member). Admins change roles in Settings.
4. `npx prisma migrate deploy && npm run db:seed`.
5. BigQuery: create the summary tables (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)), copy `config/bigquery-mapping.example.json` to `config/bigquery-mapping.json` with the real names, set `BQ_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` (service account with BigQuery Data Viewer + Job User).
6. Set `DATA_ADAPTER=synced`, run `npm run sync` once, then `npm run build && npm start`.
7. Schedule `npm run sync` daily (Windows Task Scheduler, cron, or a free GitHub Actions schedule).

The `service_role` key is never needed and must not be put in this app.

## Refresh button
Admins see **Refresh data** in the top bar. It runs the same sync as the daily job, enforces a 60-second cooldown, refuses to run twice at once, and reports failures without touching existing data. In mock mode it explains there is nothing to refresh.

## Roles
Admin: everything, plus Settings and Refresh. Member: analytics, notes, tasks, CSV export. Enforced server-side ([src/server/auth/rbac.ts](src/server/auth/rbac.ts)).

## Safety rails
- `DATA_ADAPTER=mock` throws in production; no silent fallback to mock. Unavailable sources show an explanation.
- The cookie dev login only works when `NODE_ENV!=production` and `AUTH_DEV_LOGIN=true`.
- BigQuery credentials and DB URLs are server-side only.

Checks: `npm run typecheck && npm run lint && npm test && npm run build`.
