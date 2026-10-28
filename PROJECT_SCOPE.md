# Project Scope: Biz Customer Intelligence Platform (Axonify DataConnect)

_Last reviewed: 2026-10-28. Companion file: [TASKLIST.md](TASKLIST.md)._

## 1. Purpose
An internal Next.js web app for Biz Group customer-success teams (5 to 10 staff) that shows Axonify
learning-platform data for Biz Group's clients, read from Google BigQuery (Axonify DataConnect), together
with internal notes, tasks and alerts. It also serves a client-facing QBR dashboard that recreates the
Power BI report "Axonify-CSM-PowerBI-Dash" (spec: [axonify-dashboard-spec.md](axonify-dashboard-spec.md)).

## 2. In scope
| Area | What it does | Where |
|---|---|---|
| Portfolio and Client 360 | Quarterly participation, knowledge, health score, risk band, alerts per client | `src/app/(app)/*`, `src/server/services/*`, `src/server/metrics/*` |
| QBR dashboard (`/qbr`) | 10 pages: Home, Engagement, Knowledge, Content, Usage, Teams, Topics, Matrix, Delivery, Progression | `src/app/qbr/*`, `src/components/dashboard/*`, `src/server/dashboard/*` |
| BigQuery to Postgres sync | `npm run sync` or admin "Refresh data" reads BigQuery once, stores summaries in Supabase Postgres | `src/server/sync`, `src/server/dashboard/bigquery/*`, `scripts/sync.ts` |
| Auth and roles | Supabase Auth; Admin, Member, Client (pinned to one client, QBR only) | `src/server/auth/*`, `src/middleware.ts` |
| Collaboration | Notes, tasks, alert acknowledgements, CSV export | `src/app/api/*`, `src/components/tables/*` |
| Data reliability | Metric definitions, sync status, source freshness | `src/app/(app)/data-reliability` |

## 3. Out of scope (for now)
- Salesforce (accounts, contracts, renewals, licensing, ARR): adapter is a stub (Phase 3).
- Learning paths/SCORM, communications, MAX, checkpoints, chat (Phase 2).
- Excel/PDF/QBR report generation, cloud deployment tooling, E2E tests (Phase 4).
- Writing anything back to BigQuery or Axonify. The app is read-only against both.

## 4. How it works
```
BigQuery  cosmic-kite-473215-j8.axonify___bizgroup_emea   (251 DataConnect views, read-only)
   │  14 parameterised SQL queries (src/server/dashboard/bigquery/queries.ts), filtered by @tenants
   ▼
runSync()  (src/server/sync/index.ts)    guards: 60s cooldown, single run, empty-source = keep old data
   ├─ clients + clientPeriod rows (quarterly)  → SyncClient, SyncClientPeriod   → Portfolio / Client 360
   └─ per-tenant DashboardData JSON (assemble.ts) → SyncDashboard (one JSON per client) → /qbr pages
   ▼
Supabase Postgres  →  Next.js server components  →  browser
```
- Tenants covered come from `BQ_TENANT_IDS` (16 configured). Each Axonify tenant is one client.
- Pages never call BigQuery on a click; they read the last sync ("as of" = sync time).
- `DATA_ADAPTER=mock` is synthetic and refused in production; `synced` reads Postgres.
- Charts and KPIs that depend on a date range use `YYYY-MM` months and the shared `from`/`to` URL params.

## 5. Metric definitions (as implemented)
Source of truth in code: `src/server/metrics/definitions.ts`, `calculations.ts`, `src/server/dashboard/calc.ts`, and the SQL in `queries.ts`.

| Metric | Formula | Source / notes |
|---|---|---|
| Active users | `SUM(employee_count)` per team-month (QBR) / distinct users with `user_is_active` per quarter (portfolio) | **QBR figure over-counts, see TASKLIST A1** |
| Logged-in users | `SUM(employee_logged_in_count)` | team monthly view |
| Training users | `SUM(employee_training_count)` (QBR) / active users with `training_sessions_30_day > 0` (portfolio) | |
| Participation | training users ÷ active users | Report measure (Team Participation). Home/Engagement KPIs use the latest month in range |
| Avg frequency | user-weighted mean of `average_frequency` (sessions per active user per month) | Team views roll up by weight = `employee_count` |
| Avg time per day | user-weighted mean of `average_time_spent_per_day_minutes` | |
| Current / baseline knowledge | mean of `current_score` / `baseline_score` over every active user-topic-level row (Axonify Knowledge Summary method); values above 1 divided by 100 | `analytics_SDE_topic_progress`; current snapshot, **not** date-ranged |
| Knowledge lift | current minus baseline | per topic and per frequency bucket |
| Confidence | mean `current_confidence` over active user-topic records (scale 0-100, includes Not Started rows at 0) | `content_user_topic_progress` |
| Experts | learners whose mean current score ≥ 90 | App rule; report DAX not visible |
| Topic completion | share of active user-topic records with status Graduate | |
| Engagement Health (Account Health Score) | 0.5 × participation + 0.5 × knowledge (0-1, shown as %) | Report DAX. Sample check: 0.5×32% + 0.5×85% = 58.5% vs report 59% |
| Health band (portfolio) | ≥75 Healthy, ≥60 Moderate, ≥45 At risk, else Critical | Report DAX |
| Team status | score = (min(p/0.75,1) + min(f/6,1)) / 2; ≥0.85 High, ≥0.60 Medium, else Low | Report thresholds |
| Team trend | latest vs previous month participation: ±3 points = Rising/Declining, else Stable | Report |
| Engagement rate / retention / feature adoption (portfolio) | active ÷ registered / retained ÷ previous active / used ÷ available | **Provisional**, not in report; feature adoption has no source (always empty) |
| Learner segments (matrix) | Non-participants (0 sessions), Graduated (≥95% graduate), Experts (K≥.9, C≥.7), Overconfident (K<.4, C≥.7), Underconfident (K≥.9, C<.5), Needs coaching (K<.5), else Intermediate | Report-derived; Overconfident and Non-participants are additions to the spec's five |
| Content flag / review priority | rule ladder on L1/L2/L3 counts, modules, target groups | Report; staff-only |
| Saturation | released questions ÷ 12 | **Provisional** (report formula not visible) |
| Avg question pool / months to graduate | mean released questions across a learner's topics; pool ÷ mean answers per learner in last 30 days | Matches report for Emirates (2.09K) |
| Usage totals | logins, training activities, hours (`time_spent` seconds ÷ 3600), games, points spent, broadcasts, per month | `foundation_user_login_record`, `content_user_training`, `game_play`, ... |
| Feature usage | users of feature in last 30 days ÷ active users in latest month | not date-ranged |

## 6. Known data caveats (summary; detail and status in TASKLIST.md)
- Latest month and latest quarter are partial (data to date), so they read low against full months.
- Knowledge, confidence, progress, matrix, features, platform and hour charts are snapshots, not date-ranged.
- Industry, CSM owner and Salesforce ID are not in BigQuery; portfolio shows "Unknown".

## 7. Environments and config
`.env` (see `.env.example`): `DATA_ADAPTER`, Supabase URLs/keys, `ADMIN_EMAILS`, `BQ_PROJECT_ID`,
`BQ_DATASET` (three underscores: `axonify___bizgroup_emea`), `BQ_TENANT_IDS`, Google credentials (service
account or `gcloud auth application-default login`). Checks: `npm run typecheck && npm run lint && npm test && npm run build`;
`npm run bq:check` dry-runs every query for free.

## 8. Success criteria
1. Every KPI on `/qbr` reconciles to BigQuery distinct counts (within refresh-lag) and to the Power BI report for the same client and date.
2. Each metric on screen has a definition users can read, and provisional ones are labelled.
3. Sync is safe: failure keeps old data, runs daily, and the "as of" stamp is honest.
4. Client users see only their own client.
