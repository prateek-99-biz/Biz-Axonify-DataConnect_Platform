# Assumptions and missing inputs

## Not provided / unconfirmed (blocks going live)
1. **BigQuery**: project, dataset, DataConnect view names and the reporting-table columns. Only a mapping file contract exists.
2. **Salesforce**: org, auth flow, object/field API names for accounts, contracts, renewals, licenses, CSM owner. Not integrated.
3. **Roles**: simplified to Admin/Member for a 5–10 person team. Finer roles (CSM, Analyst, Leadership) were dropped.
4. **Metric definitions**: every formula, the health-score weights (0.5/0.3/0.2), risk bands (<40 critical, <60 watch), the "declining engagement" threshold (−3 pts), the 72h stale-data SLA and user lifecycle bands are placeholders chosen to make the mock slice computable. Replace after Biz Group sign-off.
5. **Quarters** are calendar quarters; confirm vs fiscal.
6. **Industry taxonomy** and CSM ownership source (Salesforce account owner vs Axonify) are undecided.
7. The Axonify **Power BI pitch deck** was not available: colours follow the brief (#82C657, #1D2B43, #EEF6E8) only.

## Mock adapter
Synthetic, deterministic, fictional clients. The UI shows a MOCK DATA badge. Intentionally includes unmapped Salesforce IDs, stale/missing sources and a row gap to exercise reliability views. Salesforce-derived modules show "unavailable" rather than invented contracts.

## Known limitations
- Phase 2–4 modules (knowledge, content, learning paths, features, communications, MAX, renewals calendar, licensing, reports) are not built and not in the navigation.
- CSV export is client-side from already-loaded table rows; Excel/PDF/QBR reports are Phase 4.
- Alerts are derived on the fly from metrics (not stored rules); acknowledgments are stored per user.
- Supabase sign-in is untested against a real Supabase project (only the dev-only cookie login and the sync failure path were exercised locally).
- The BigQuery→Postgres sync has not run against real BigQuery; only its failure/no-mapping path was exercised.
- Team, user and source-coverage views exist on mock data only until corresponding summary tables are synced.
- There is no audit log (removed to keep things simple).
