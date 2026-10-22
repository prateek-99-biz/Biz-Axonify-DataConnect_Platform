# Roadmap

| Phase | Scope | State |
|---|---|---|
| 1 | Shell, auth/RBAC, client directory, portfolio, Client 360, engagement, team hierarchy, filters, data reliability | Built on mock adapter |
| 2 | Knowledge, content, learning paths/SCORM, feature adoption, communications, MAX, tasks, checkpoints, discover/chat | Not started (needs reporting tables per module) |
| 3 | Salesforce accounts, contracts, renewals (30/60/90), anniversaries, licensing, ARR/ACV, CSM activity, stored alert rules | Task/notes/alert-ack storage exists; Salesforce adapter is a stub |
| 4 | Excel/PDF/QBR reports, caching, performance monitoring, CI/CD, E2E tests | Not started; CSV export only (no cloud deploy tooling: run on one machine) |

Immediate next steps: obtain BigQuery/Salesforce mappings, agree metric definitions, build reporting-table jobs, admin UI for `ClientMapping`.
