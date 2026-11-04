# Architecture

```
Browser ── Next.js (server-rendered pages, route handlers, server actions)
              │ auth() + requirePermission() on every entry
              ├── services/   (portfolio, context, clients)  ← pure metric functions in metrics/
              ├── data/ports.ts  AnalyticsPort · CrmPort   (typed, provenance-carrying Result<T>)
              │     ├── adapters/mock      dev only; refused in production
              │     ├── adapters/synced    reads daily-synced summaries from Postgres  (used by the app)
              │     ├── adapters/bigquery  used ONLY by the sync job; reads tables named in config/bigquery-mapping.json
              │     └── adapters/salesforce stub (live connection not built)
              ├── salesforce-accounts  static CSV rows (SalesforceAccount, keyed by Axonify client id) overlaid on clients (applySalesforce)
              ├── accounts.ts          pure functions for the internal pages: cards, week agenda, watchlist, renewals, CSM routing
              ├── sync/     runSync(): BigQuery → Postgres (CLI `npm run sync` and POST /api/sync)
              └── Prisma → Supabase Postgres (profiles, client mapping, notes, tasks, alert acks, metric definitions, synced summaries, sync runs)
Auth: Supabase Auth (email+password); profile row (AppUser) holds the role.
```

## Why summaries instead of live BigQuery
Each BigQuery query costs about a second or more and is billed by data scanned. The app never queries the 251 DataConnect views per click: a scheduled query aggregates into small tables, the sync copies them to Postgres daily, and pages read locally.

## Summary tables the sync expects (names supplied via mapping file, not assumed)
| Table | Grain | Columns consumed |
|---|---|---|
| client dimension | client | id, name, industry, csm email/name, Axonify tenant ID, Salesforce Account ID |
| client-period summary | client × calendar quarter | registeredUsers, activeUsers, trainingUsers, knowledgeLearners, avgKnowledge, retainedUsers, previousActiveUsers, sessions, featuresAvailable, featuresUsed |

Team hierarchy, user lists and source coverage are **not** in the synced summaries yet, so those tabs show “unavailable” on the synced adapter (they work on mock data). Adding them means extra summary tables, sync tables and adapter methods.

## Internal pages
My Accounts, Alerts and Watchlist, Renewals and Internal Home read the synced client-period rows plus the Salesforce overlay, and `account-signals.ts` (open tasks, last note). All the decisions (health band, partial-period guard, Check Data, renewal windows, who is a CSM) are in `accounts.ts` and `metrics/` and are unit-tested. Sample rows are prefixed `MOCK-SF-` with `@sample.invalid` emails so they can be removed without touching real data.

## Sync behaviour
Entry points: `npm run sync`, the Refresh Data button (`POST /api/sync`), and the Windows scripts in `scripts/` (`sync-now.ps1`, `schedule-sync.ps1`). All read BigQuery through Google Application Default Credentials, which today means a person's gcloud sign-in; see [DATA_REFRESH.md](DATA_REFRESH.md). Single `SyncRun` row per attempt (running/ok/failed). Refuses concurrent runs and runs within 60 s of the last finish. Source errors or empty results leave existing data untouched. Replacement of summaries happens in one transaction.

## Metrics
All formulas live in `src/server/metrics/definitions.ts` and are shown in the UI. Participation, knowledge, health score and health bands mirror the Power BI report; engagement, retention and feature adoption are provisional. Portfolio rates are ratio-of-sums. Full-year active and training users = mean of quarterly values; registered users and knowledge = latest quarter.

## Security
Supabase session cookies are verified with Supabase on each request (`getUser`). Middleware is only a redirect convenience; authorization is in server code. Only the public anon key is used in this app.
