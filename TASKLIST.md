# Task List

_Last updated: 2026-10-28. Scope and metric definitions: [PROJECT_SCOPE.md](PROJECT_SCOPE.md)._
Legend: [x] done/verified, [ ] open. Priority: P0 wrong numbers on screen, P1 misleading, P2 polish.

## A. Data accuracy findings (from the 2026-10-28 audit)
Method: all 14 queries dry-run against live BigQuery (all valid); the full dashboard pipeline run read-only for all 16 tenants; Emirates (tenant 324) compared with the Power BI spec and with direct distinct-user SQL.

- [x] **A1 (P0) FIXED 2026-10-28.** QBR user counts are about 2.9x too high.** `teamMonthly` sums `employee_count` over all team rows, but the team view is a hierarchy roll-up (parent and child both carry the same members, e.g. AMERICAS 10 and SAO PAULO 10). Emirates, Oct 2026: app shows active 8,104 / logged-in 2,806 / training 2,595; distinct users from `foundation_user_monthly_participation` are 2,774 / 963 / 889 (report sample: ~3K / 894 / 821). Participation % is unaffected (32.0% both ways) and so is the health score, but Active, Logged-in and Training user KPIs and the user weights behind frequency and time are wrong. Fix: take account-level counts from the distinct-user view; keep team rows for the team table only.
- [x] **A2 (P0) FIXED 2026-10-28.** Team tree is not built.** `teamPath()` in `assemble.ts` splits on `" > "` or `"/"`, but DataConnect uses `" | "` ("Retail | AMERICAS | SAO PAULO"). Every team becomes a child of a node named by its whole hierarchy string (Emirates: 614 nodes for 289 teams), so the Teams slicer has no real hierarchy and "leaf" logic treats parent teams as leaves. Fix: split on `|`; then decide how roll-up rows are shown (A1).
- [x] **A3 (P0) FIXED 2026-10-28.** Learner confidence is mis-scaled in the matrix.** The scale is 0-100 (max seen 860). The matrix SQL treats an average ≤ 5 as 0-5 and ≤ 10 as 0-10, so a learner at 3% confidence becomes 60%. Flydubai: 2,597 of 7,413 learners have a mean confidence in 1-10 and are inflated, which feeds the "Underconfident 1,407" bucket. Fix: treat `current_confidence` as 0-100 everywhere, as `knowledgeAccount` already does.
- [ ] **A4 (P1) Confidence KPI is diluted by Not Started rows.** The average includes records at 0 for topics never started (Emirates: 223K of 300K rows). It matches the report (49%) but reads very low for other clients (flydubai 7.6%). Decide: keep to match the report, or average only started topics, and label accordingly.
- [ ] **A5 (P1) Topic names fall back to "Topic <id>".** Name comes only from `analytics_SDE_topic_progress`; topics with no learner scores (Emirates: 246 of 294 released) show a placeholder and no knowledge. The join is correct (all 48 scored topics match on `external_id`). Fix: pull the name from the translatable-string tables or hide unscored topics in the knowledge chart.
- [x] **A6 (P1) RESOLVED (reframed) 2026-10-28.** Latest month and quarter are partial.** "Latest month" KPIs read the current in-progress month (Oct 2026 as of 28 Oct), so low-activity clients look worse (cbuae logged-in 6 of 401). Same for the latest quarter in the portfolio. Add a "month to date" marker or default to the last complete month.
- [ ] **A7 (P1) "Avg Participation / Avg Frequency" KPIs are latest-month values, not averages over the range.** Confirm against the report's DAX (semantic model) and rename or recompute.
- [ ] **A8 (P1) Parent teams with their own members are excluded from team tables** (only leaves are listed). Revisit once A1/A2 are decided.
- [ ] **A9 (P1) Team query filters `current_team_status = 'active'`**, so history for since-closed teams drops out and past months can differ from the report. Confirm intended.
- [x] **A10 (P2) FIXED 2026-10-28.** Inconsistent status filters:** usage totals use `status = 'Active'`, the hour chart uses `NOT IN ('Deleted','Cancelled')`. Equivalent today (Emirates: 14,754 Active, 2 Deleted) but should share one rule.
- [x] **A11 (P2) DONE 2026-10-28 (labelled).** Knowledge, progress, matrix, features, platform and hour views ignore the date slicer** (snapshots / last 30 days). Label each on screen.
- [ ] **A12 (P2) Provisional metrics need sign-off:** Experts (≥90), saturation (÷12), engagement rate, retention, feature adoption (no source, always empty), 72h stale SLA.
- [ ] **A13 (P2) Spec typo:** the spec writes dataset `axonify__bizgroup_emea` (two underscores); the real name is `axonify___bizgroup_emea` (three). Code is right; fix the spec.

### Verified correct
- [x] All 14 SQL queries dry-run valid on live BigQuery (scans about 21 GB combined per sync).
- [x] 38 unit tests pass; query views and qualified columns are checked against `config/bigquery-schema.json`.
- [x] Emirates matches the report: participation 32%, baseline 71%, current 83%, confidence 49%, topic completion 14%, avg question pool 2,090, months to graduate 19.5 (report 18.5), content items 2.3K, active topics 294 (report 288), health 57% (report 59%, knowledge differs by data age).
- [x] Health formula, health bands, team status and trend thresholds match the report as recorded.
- [x] Content Delivery now shows real programs (Emirates: 19 of 51 groups have programs; the report showed zeros).
- [x] Progression rows sum to 100% per level (the report's did not).

## B. Not yet verified
- [ ] **B1** Supabase database was unreachable from this machine during the audit, so whether `npm run sync` has populated `SyncDashboard` and what the live pages show is unconfirmed. Run the sync and compare the pages with section A.
- [ ] **B2** Compare 2-3 other clients (e.g. flydubai, jlearning) with the Power BI report, not just Emirates.
- [ ] **B3** Supabase sign-in against a real project (only the dev login was exercised).
- [ ] **B4** Confirm the report's DAX for Experts, Avg Participation, Avg Knowledge (home shows 85% vs Knowledge page 83%).

## C. Platform backlog (from docs/ROADMAP.md)
- [ ] C1 Admin UI for `ClientMapping` (industry, CSM, Salesforce ID are unknown today).
- [ ] C2 Salesforce adapter (Phase 3): accounts, contracts, renewals, licensing, ARR.
- [ ] C3 Phase 2 modules: learning paths/SCORM, communications, MAX, checkpoints.
- [ ] C4 Phase 4: Excel/PDF/QBR export, caching, monitoring, CI/CD, E2E tests.
- [ ] C5 Schedule `npm run sync` daily (Task Scheduler / cron / GitHub Actions).
- [ ] C6 Team, user and source-coverage views on synced data (currently mock-only).
- [x] C7 Regression tests for A1-A3 added in `bigquery.test.ts` (roll-up rows, `|` hierarchy, 0-100 confidence).
- [ ] C8 Commit the large working-tree change set (about 45 modified and several new directories are uncommitted).

## D. Fix log
- 2026-10-28 A1-A3: `topRows()`/`aggregateMonths(rows, teams)` in `calc.ts` add only top-most team rows; `teamPath()` splits on `|`; confidence is `/100` in the matrix SQL and `norm100()` in `assemble.ts`. Re-run on live data: Emirates Oct 2026 now active 2,754 / logged-in 963 / training 889 (distinct-user SQL: 2,774 / 963 / 889), team nodes 614 -> 309, flydubai "Experts" 283 -> 9. A sync is needed before the stored snapshots show the corrected numbers.

## E. Verification against the Axonify AdminZone (nfxp.axonify.com, tenant 352), 2026-10-28
Source: AdminZone > Reports > Participation and Knowledge Summary, compared with BigQuery and the platform pipeline (post A1-A3).

| Metric | Axonify report | Platform | Verdict |
|---|---|---|---|
| Employees (Oct) | 8,630 (1,299 + 7,331 not logged in) | active 8,630 | match |
| Employees logged in | 1,299 | 1,299 | match |
| Completed training | 934 | 934 | match |
| Avg Training Participation | 11% | 10.8% ("Participation") | match (see E2) |
| Avg Participation | 15% (= logged in ÷ employees) | not shown | naming gap (E2) |
| Avg Frequency (days) | 13.1 | 13.8 | **mismatch (E1)** |
| Current Knowledge | 89.4% | 85.7% | **mismatch (E3)** |
| Knowledge lift vs baseline | +11 points | +6.3 points (79.4% to 85.7%) | **mismatch (E3)** |

- [x] **E1 (P0) FIXED 2026-10-28.** Frequency is weighted by the wrong users.** `aggregateMonths` weights team `average_frequency` (and time per day) by `employee_count`, but the team average is over logged-in users. Weighting by `employee_logged_in_count` gives 13.13, which matches Axonify's 13.1 (13.83 today). Fix in `calc.ts` (`aggregateMonths`).
- [ ] **E2 (P1) Naming differs from Axonify.** Axonify "Average Participation" is logged-in ÷ employees (15%), and "Average Training Participation" is training ÷ employees (11%). The platform's "Participation" (training ÷ active) equals Axonify's *Training* Participation, as in the Power BI report. Keep, but label it "Training participation" or show both.
- [x] **E3 (P1) FIXED 2026-10-28.** Knowledge averaging differs.** Axonify averages across user-topic-level rows (88.7% current, 77.7% baseline, lift 11.0 in BigQuery; the report shows 89.4% and +11, the small gap is probably answer weighting). The platform averages each learner first, then learners (85.7% / 79.4%), which matches the Power BI report for Emirates (83% / 71%). Decide which definition clients should see (Power BI parity or Axonify-admin parity), then label it. Topic status filter (Current vs All-Time) made no difference to the Axonify figure.
- [ ] **E4** Teams table lists leaf teams only; Axonify lists parents too (e.g. EPC 1 (CTJV): 5,655 employees, 656 logged in, 520 training, 11.6% / 9.2%, freq 15.8). Parent rows exist in the data; consider a toggle.
- [ ] **E5** Not yet compared: Topic Progress, User Summary, Question Summary, Training Activities/Sessions (usage), Device Popularity, other clients.
- 2026-10-28 E1: `aggregateMonths` weights frequency and time per day by logged-in users. NFXP Oct 2026 frequency 13.83 -> 13.13 (Axonify 13.1). Re-sync needed for stored snapshots.

## F. Verification: emirates.axonify.com (tenant 324), 2026-10-28 (after A1-A3, E1)
| Metric | Axonify | Platform | Verdict |
|---|---|---|---|
| Employees (Participation) | 2,754 (963 + 1,791) | 2,754 | match |
| Logged in / completed training | 963 / 889 | 963 / 889 | match |
| Avg Participation / Training Participation | 35% / 32% | 35.0% (logged-in basis, not shown) / 32.3% | match |
| Avg Frequency (days) | 11.3 | 11.28 | match (E1 fix confirmed) |
| Topic status mix (Not started / Beginner / Intermediate / Graduate / Expert) | Not started about 74% | 74.3 / 3.4 / 8.8 / 7.2 / 6.3 % | match |
| Current Knowledge / lift | 85.9% / +16 | 82.8% / +12 (learner-mean); 85.2% / +16.3 (row average) | same E3 definition gap |
| Topic Completion | 22% ("completed" = Intermediate or above) | 13.9% (Graduate only) | **definition differs (F1)** |

- [x] Emirates user counts, participation and frequency reconcile exactly; the A1 and E1 fixes are confirmed on a second client.
- [ ] **F1 (P1)** "Topic Completion" is Graduate-only on the platform (matches the Power BI report: 14%) but Axonify counts Intermediate and above (22%). Label it "Graduate topic levels" or pick one definition.
- [x] **F2 (P1) FIXED 2026-10-28.**** E3 repeats: Axonify knowledge equals the row-average (about 0.7 pt higher, likely answer weighting); platform learner-mean is about 3 points lower on current and 4 on lift.
- Still to compare: Axonify Avg Time/Day (no direct field in these reports), Training Activities/Sessions (usage), Device Popularity, User Summary, Question Summary.
- 2026-10-28 E3/F2: account knowledge, frequency-bucket knowledge and portfolio knowledge now average all user-topic-level rows (queries `knowledgeAccount`, `frequency`, `clientPeriod`). Experts (learner mean >= 90) and the matrix stay learner-based. Result: NFXP 88.7% current / +11.0 (Axonify 89.4% / +11), Emirates 85.2% / +16.3 (Axonify 85.9% / +16). Remaining ~0.7 pt gap is likely answer weighting (not in the DataConnect view). Power BI parity for knowledge is dropped on purpose. Re-sync needed.
- 2026-10-28 Cross-page items 1 and 2: every dashboard KPI and card now carries a scope tag (`ScopeTag` in `components/dashboard/primitives.tsx`: Date range / Latest month / Last 30 days / Snapshot, with a tooltip explaining each). The in-progress month is marked "(to date)" on the Home and Engagement charts, and the Usage KPIs say when the range includes the current month to date (`isCurrentMonth`, `monthAxisLabel` in `calc.ts`).
  - **Correction to A6:** the monthly participation view's `*_30_day` columns make each month a rolling 30-day window, and the latest month equals Axonify's "Last 30 days" report (verified on NFXP and Emirates). So the latest engagement month is not a partial month, and the KPI default stays on it to match Axonify. Only calendar-based totals (Usage monthly sums, the latest portfolio quarter) are truly partial; those are now labelled. Not yet checked visually in the browser (Supabase unreachable from here).
- 2026-10-28 Cross-page items 3-5:
  - **Item 3 (definitions):** `src/server/dashboard/definitions.ts` holds one definition per KPI, shown as a tooltip on each tile (`KpiTile metric=...`). Renamed to Axonify wording: "Training Participation" (was Participation / Avg Participation), "Topic Completion (Graduate)", "Team training participation"; frequency is described as days active per logged-in user (Axonify's label is "Average Frequency (Days)"; not yet checked against the raw `average_frequency` column semantics). E2 and F1 are now documented on screen; the underlying measures are unchanged.
  - **Item 4 (scales and gaps):** knowledge/confidence are always read as 0-100 (verified: no non-zero score at or below 1 across all 16 tenants) via `norm100`; SQL ratios are read as 0-1 via `ratio01`; the `norm01` guess is gone. The matrix SQL no longer guesses scale either. Topic completion and avg question pool are `null` (shown as a dash) when there is no data, not 0. The BigQuery portfolio adapter stores knowledge as 0-1. **Regression found and fixed in the same change:** after A3 the matrix confidence was divided by 100 twice in `assemble.ts` (about 0.4% instead of 40%); a test now covers it. A4 (confidence includes Not Started rows at 0) is labelled in the tooltip but the calculation is unchanged, pending a decision.
  - **Item 5 (shared rules):** `queries.ts` has one set of row rules (`LIVE`, `RELEASED`, `ACTIVE_USER`, `ACTIVE_LEARNER`, `SCORED`) used by every query; event tables all use `status NOT IN ('Deleted','Cancelled')` (A10 closed; same result today since only Active/Deleted exist), content uses the same released test everywhere. Live check on NFXP and Emirates: counts and knowledge unchanged.
  - Still open from the cross-page list: item 6 (automated reconciliation script), A4 decision, A5 topic names, A7, A8, A9, E4.

## G. Automated reconciliation (item 6), 2026-10-28
- [x] **`npm run reconcile`** ([scripts/reconcile.ts](scripts/reconcile.ts), pure logic in [src/server/dashboard/reconcile.ts](src/server/dashboard/reconcile.ts), 7 unit tests). For every tenant it recomputes straight from BigQuery by a different route and compares with the dashboard data: latest-month active / logged-in / training users (distinct users from the user-level view), current and baseline knowledge (row average), user-topic-level record count, 30-day logins and training activities; plus 11 invariants (training <= logged-in <= active, scores within 0-1, frequency <= 31 days, no `|` in team names, every team row has a known team, no negative counts). Exit code 1 on any failure. Options: `--tenant=324,352`, `--snapshot` (compare what is stored in Postgres, i.e. what the pages show, to run after `npm run sync`).
- [x] Optional AdminZone anchors in [config/axonify-reference.json](config/axonify-reference.json) (NFXP, Emirates as read on 2026-10-28). They are compared only within 3 days of capture because Axonify shows rolling 30-day windows; after that they are reported as skipped. Recapture by reading Reports > Participation and Knowledge Summary and updating values and `capturedOn`.
- First full run (16 tenants): 325 passed, 5 failed.
- [x] **G1 RESOLVED 2026-10-28, not a bug.** Verified on boehringer.axonify.com: the default Participation view ("Users in Active Training Programs") shows 700 employees, 412 logged in, 378 completed training, 15.2 days, which equals the platform and the team view. The "All Users" view shows 926 / 425 / 381, which equals the user-level BigQuery view. The two differ only for clients with users outside active programs (boehringer, jlearning, learninghub, tiraedx); NFXP and Emirates are identical. The platform follows Axonify's default view. `reconcile` now treats the user-level count as an upper bound (`compareAtMost`) and checks equality against the AdminZone anchors (Boehringer added); full run: 334 passed, 0 failed. If clients should see all users instead, take the counts from the user-level view. Original finding: $1

## H. Full check: functional, code audit, visual (2026-10-28)
**Functional:** typecheck clean, lint clean, 53 tests pass, production build passes (26 routes), 14/14 BigQuery dry-runs valid, `reconcile` 334/334 on fresh data. `reconcile --snapshot` on what is stored in Postgres: 237 passed, **97 failed**: the 16 snapshots were synced at 07:20 UTC, before the A1-A3, E1, knowledge-method and scale fixes, so the pages still show the old numbers (e.g. NFXP 17,034 active vs 8,630 in AdminZone; team tree still shows "Contact Center | MAN" as top-level nodes). **A re-sync is required** (admin "Refresh data" or `npm run sync`), then `npm run reconcile -- --snapshot` should be clean.

**Visual (dev server, Chrome pane):** all 10 QBR pages, portfolio, Client 360 and data reliability render; dark and light themes OK; phone width (375px) has no horizontal overflow; CLIENT login is pinned to its own client (`?client=352` still shows its own), staff pages redirect to /qbr, `/api/sync`, `/api/search` and notes return 403.
- [x] Found and fixed: KPI scope tags were never rendered inside tiles (an earlier edit silently missed on CRLF line endings; no test covered rendering).
- [x] Found and fixed: scope tag text was unreadable in dark mode (app inverts the slate scale; `dark:` overrides were wrong).
- [x] Fixed: frequency shown as "9.2x" on Home and in the team table; it is days ("9.2 days", header "Team frequency (days)").
- [x] Fixed: matrix legend overlapped the x-axis label.
- [ ] Content page shows "2026-10-27" while Topics shows "27 Oct 2026" (inconsistent date formats).
- [ ] Topic names fall back to "Topic TE178526" under "Uncategorised" for topics without learner scores (A5).

**Independent code audit (subagent, claims spot-checked in code):**
- [x] Fixed: open redirect on sign-in (`/\host` passed the old check): `safeCallbackUrl` in `src/lib/safe-redirect.ts` + test.
- [x] Fixed: CSV export could run formulas in Excel (cells starting `= + - @`).
- [x] Fixed: full-year portfolio aggregation used an empty latest quarter and divided by 4 even with fewer quarters of data (`aggregate`); test added.
- [x] Fixed: sync replaced a tenant's good snapshot with an empty one if its queries returned nothing; such tenants now keep their previous snapshot and the run message says so.
- [x] Fixed: portfolio "Active users" / "Engagement rate" wording: active means an active account (Axonify "Employees"), so engagement rate is about 98% and low-signal (documented, calculation unchanged).
- [ ] **High, decision needed:** new Supabase users are created as MEMBER (`src/server/auth/index.ts`), so an external client user has staff access until an admin demotes them in Settings. Safe only if public sign-ups stay disabled (README step 2). Suggested: create new users as inactive or CLIENT-without-client until promoted.
- [ ] Medium: snapshot payload is cast to `DashboardData` with no version check (`context.ts`), so an old-shape snapshot after a code change can crash pages or show stale meanings; add a `schemaVersion` and treat a mismatch as "not synced yet".
- [ ] Medium: `qbr/layout.tsx` calls `loadQbr({})`, so the From/To lists come from the first client, not the selected one, and the payload is loaded twice per navigation; no error boundary above the layout (add `global-error.tsx`).
- [ ] Medium: sync lock is check-then-create (two simultaneous refreshes can both start), no BigQuery timeout, no `maxDuration`.
- [ ] Medium: malformed JSON bodies return 500 not 400; `tasks/[taskId]` maps any DB error to "not found".
- [ ] Low: `normKnowledge` threshold guess (portfolio); frequency bucket boundary (exactly 20 sessions); mapping-file parse errors are swallowed; `auth()` is not cached per request.
- Housekeeping: `.claude/launch.json` (dev server config for the preview) was added and is untracked.

## I. Slow or missing graphs on large clients (2026-10-29)
**Cause:** client dashboards vary from 40 KB (adidas) to 4.6 MB (jlearning: 1,165 teams, 22,642 team-month rows). Every page read the whole snapshot from Postgres (about 2.2 s for jlearning; each query is about 190 ms from the dev machine) and the heavy pages sent raw rows to the browser (Engagement and Teams 5 MB for jlearning, Delivery 2 MB for chalhoubgroup, Topics and Knowledge 2 MB).
- [x] Storage split: `SyncDashboard` is now a small core row and the large arrays live in `SyncDashboardPart` (sections `teams`, `topics`, `groups`, `progress`; migration `0005`). Team rows are stored packed. Helpers and tests in [src/server/dashboard/sections.ts](src/server/dashboard/sections.ts).
- [x] `loadQbr(sp, sections)` loads only the sections a page shows; the others come back as empty arrays, so a new page that needs a section must ask for it. Snapshots written before the split still work.
- [x] Session and client list are cached per request and fetched in parallel (the floor per page went from about 1.0 s to 0.75 s).
- [x] Browser payloads are packed (`packRows`, `packTeamMonths`); Delivery builds its table rows in the browser.
- Result (dev server): Matrix for jlearning 4.9 s to 1.0 s; Progression 3.3 s to 1.0 s; Delivery for chalhoubgroup 7.4 s and 2.0 MB to 1.2 s and 0.23 MB; Content for chalhoubgroup 1.0 MB to 0.45 MB; Engagement for jlearning 5.2 MB to 1.1 MB. Topics, Knowledge (chalhoubgroup) and Engagement, Teams (jlearning) are still about 2 to 3 s in the dev server, which adds large overhead; the data path itself is at most 0.5 s of database time and under 20 ms of CPU, with 0.3 to 0.65 MB of JSON.
- Rounding: stored team frequency and time are rounded to 4 decimals.
- [x] Existing snapshots were converted in place from Postgres (the BigQuery login had expired, `invalid_rapt`). The next `npm run sync` writes the split layout directly; that write path is covered by unit tests but has not run against BigQuery yet. Re-run `gcloud auth application-default login` first.
- [ ] Not done: `reconcile --snapshot` against BigQuery (needs the same login). Topics and Knowledge could shrink further by rounding score floats.

## J. Full visual test (2026-10-29)
Dev server, Chrome pane. All 19 routes at 1440 px light; QBR Home, Engagement, Matrix, Delivery and Portfolio in dark; every page at 375 px; plus an automatic scan per page for error screens, NaN/undefined text and horizontal overflow. Large clients (jlearning, chalhoubgroup) used for the heavy pages.
- [x] Clean: no error screens, no console errors, no bad values, no page overflow, charts and tables render, scope tags and KPI tooltips present, hover sidebar works.
- [x] Fixed: the main app had no navigation on a phone (sidebar hidden below 768 px, nothing replaced it). Added `MobileNav` ([src/components/shell/mobile-nav.tsx](src/components/shell/mobile-nav.tsx)), same pages and filter carry-over as the sidebar.
- [x] Fixed: a long failed-sync message (BigQuery error JSON) ran off the screen on Data reliability at phone width.
- [ ] Known and unchanged: topic names show as "Topic TE…" for topics without scores (A5); Content shows "2026-10-22" while Topics shows "22 Oct 2026"; Client directory shows industry "Unknown", no CSM and "No Salesforce account" for every client (mapping not filled in).
- Not covered: tablet widths, the CLIENT role's own view (only the admin was used), keyboard-only use, and a production build (dev login is off there).

## K. Default role and speed, round 2 (2026-10-29)
- [x] **New users no longer get staff access.** `seedRole` in [src/server/auth/rbac.ts](src/server/auth/rbac.ts): listed admins and other `@bizgroup.ae` emails get ADMIN / MEMBER only when Supabase has confirmed the email; everyone else starts as an unlinked CLIENT who sees only "not linked to a client yet" until an admin links them in Settings. Existing profiles keep their stored role (only the two dev users exist today). Tests in `rbac.test.ts`.
- [x] **In-process cache** ([src/server/cache.ts](src/server/cache.ts)): client list, period rows, last-sync time, dashboard core and sections (60 s) and user profiles (15 s). Cleared after a sync and after a role change in Settings; concurrent requests share one load; failures are not cached. Other server instances and the CLI sync pick up changes when entries expire.
- [x] Independent queries now run together: last-sync + data in the synced adapter, alert acknowledgements + context in the app layout.
- Result (dev server, per request): Portfolio 1.06 s to 0.50 s; Clients 1.0 s to 0.40 s; Client 360 1.05 s to 0.42 s; Data reliability 0.96 s to 0.40 s; QBR Home 0.8 s to 0.28 s; QBR Usage 0.77 s to 0.19 s.
- Still slow in the dev server (2 to 3 s, 1.1 to 1.5 MB): QBR Engagement/Teams for jlearning and Topics/Knowledge for chalhoubgroup. The server work is about 0.5 s; the rest is Next's dev-mode rendering of the large props. Not measured in a production build (dev login is off there).
- Cached values are shared between requests and must be treated as read-only (checked: no code sorts or mutates them).
- [ ] Not done: stale-data warning banner / sync-failure alerts, schemaVersion on snapshots, sync lock and timeouts, lazy-loading charts, virtualised team and topic lists.
