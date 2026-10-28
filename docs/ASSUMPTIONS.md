# Assumptions and missing inputs

## Not provided / unconfirmed (blocks going live)
1. **BigQuery**: project `cosmic-kite-473215-j8`, dataset `axonify___bizgroup_emea` (251 DataConnect views, listed with columns in `config/bigquery-schema.json`). The queries in `src/server/dashboard/bigquery/queries.ts` come from the Power BI report's SQL and are checked offline against that schema file; `npm run bq:check` dry-runs them against BigQuery once credentials exist. They have not run against real data yet. Assumptions: registered users come from `foundation_user` (create, terminate and delete dates); `time_spent` is in seconds; knowledge is a current snapshot, so only the latest quarter has it in the portfolio rows; feature adoption has no per-quarter source; industry, CSM and Salesforce IDs are not in the tenant table.
2. **Salesforce**: org, auth flow, object/field API names for accounts, contracts, renewals, licenses, CSM owner. Not integrated.
3. **Roles**: simplified to Admin/Member for a 5–10 person team. Finer roles (CSM, Analyst, Leadership) were dropped.
4. **Metric definitions**: participation (training users ÷ active users), knowledge, the health score (0.5 participation + 0.5 knowledge), the health bands (75 / 60 / 45) and the 3-point decline threshold are taken from the Axonify CSM Power BI report (DAX read from its template). Engagement rate (active ÷ registered), retention and feature adoption are not in the report and remain provisional; they are excluded from the health score. The 72h stale-data SLA and user lifecycle bands are still placeholders. Contracted licenses (report: Avg Utilization) are not available.
5. **Quarters** are calendar quarters; confirm vs fiscal.
6. **Industry taxonomy** and CSM ownership source (Salesforce account owner vs Axonify) are undecided.
7. The Axonify **Power BI report** (`.pbix`) supplied the colours (#79C753, #00AA61, #EEF7E8, navy #1D2B43) and the metric formulas above.

## Mock adapter
Synthetic, deterministic, fictional clients. The UI shows a MOCK DATA badge. Intentionally includes unmapped Salesforce IDs, stale/missing sources and a row gap to exercise reliability views. Salesforce-derived modules show "unavailable" rather than invented contracts.

## Dashboard build decisions (from axonify-dashboard-spec.md)
- Participation is training users ÷ active users; KPIs use the latest month in the selected range, charts show every month in it.
- One shared date range (default last 13 months) replaces the Usage page's different default.
- Content Delivery and Content Progression are top-level pages, and the homepage links to all nine other pages.
- Content Progression rows are shares of their own level's records, so they sum to 100% (the source matrix did not).
- One progress palette on every chart; Graduate and Expert are greens, Not started is neutral.
- "More details" on Team Performance expands a full ranked team table.
- The matrix page's empty box became a reading guide plus a segment table.
- Content Flag, Review Priority and the data-quality notes are shown to staff only. Saturation is released questions ÷ 12 (provisional; the report's formula was not visible).
- Dashboard data is synthetic until the BigQuery sync has run; after it, `/qbr` reads one JSON snapshot per client from Postgres.
- Report issues found while mapping the schema: the Usage fact used a different tenant list from the account list (it included 157, 231, 244 and 381 and missed 384, 386, 385, 361 and 370); Content Delivery showed zeros because programs were counted only through the fast-track audience link, so the new query also counts `content_program_item` assignments; the Usage page's platform slicer cannot filter the hourly chart because the training table has no platform.

## Known limitations
- Phase 2–4 modules (knowledge, content, learning paths, features, communications, MAX, renewals calendar, licensing, reports) are not built and not in the navigation.
- CSV export is client-side from already-loaded table rows; Excel/PDF/QBR reports are Phase 4.
- Alerts are derived on the fly from metrics (not stored rules); acknowledgments are stored per user.
- Supabase sign-in is untested against a real Supabase project (only the dev-only cookie login and the sync failure path were exercised locally).
- The BigQuery→Postgres sync has not run against real BigQuery; only its failure/no-mapping path was exercised.
- Team, user and source-coverage views exist on mock data only until corresponding summary tables are synced.
- There is no audit log (removed to keep things simple).
