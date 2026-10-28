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
- [ ] **A6 (P1) Latest month and quarter are partial.** "Latest month" KPIs read the current in-progress month (Oct 2026 as of 28 Oct), so low-activity clients look worse (cbuae logged-in 6 of 401). Same for the latest quarter in the portfolio. Add a "month to date" marker or default to the last complete month.
- [ ] **A7 (P1) "Avg Participation / Avg Frequency" KPIs are latest-month values, not averages over the range.** Confirm against the report's DAX (semantic model) and rename or recompute.
- [ ] **A8 (P1) Parent teams with their own members are excluded from team tables** (only leaves are listed). Revisit once A1/A2 are decided.
- [ ] **A9 (P1) Team query filters `current_team_status = 'active'`**, so history for since-closed teams drops out and past months can differ from the report. Confirm intended.
- [ ] **A10 (P2) Inconsistent status filters:** usage totals use `status = 'Active'`, the hour chart uses `NOT IN ('Deleted','Cancelled')`. Equivalent today (Emirates: 14,754 Active, 2 Deleted) but should share one rule.
- [ ] **A11 (P2) Knowledge, progress, matrix, features, platform and hour views ignore the date slicer** (snapshots / last 30 days). Label each on screen.
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
