# Roadmap

| Phase | Scope | State |
|---|---|---|
| 1 | Shell, auth/RBAC, client directory, portfolio, Client 360, engagement, team hierarchy, filters, data reliability | Built on mock adapter |
| 2 | Knowledge, content, learning paths/SCORM, feature adoption, communications, MAX, tasks, checkpoints, discover/chat | Partly built: monthly usage per client for Max, broadcasts, chat, communities, Discover, games, rewards, recognition, tasks, forms and events feeds the Insights pages. Learning paths/SCORM not started |
| 3 | Salesforce accounts, contracts, renewals (30/60/90), anniversaries, licensing, ARR/ACV, CSM activity, stored alert rules | Built from a static CSV import: My Accounts, Alerts and Watchlist, Renewals, Internal Home. Insights pages (Client Leaderboard, Account Health, Benchmarks and Features, Max AI Usage, CSM Portfolio, Cost to Serve) built. Live Salesforce connection (meetings, emails), gross profit and support hours not built |
| 4 | Excel/PDF/QBR reports, caching, performance monitoring, CI/CD, E2E tests | Not started; CSV export only. Deployed on Vercel, with scripts for a manual or scheduled refresh from a laptop |

Immediate next steps:
1. Get the Salesforce CSV from the team (docs/salesforce-data-request.md), import it, remove the sample data.
2. Unattended refresh: agree an option with the Google Cloud admin (docs/DATA_REFRESH.md), then build the credentials helper and the `/api/cron/sync` route.
3. Agree the provisional metrics (engagement rate, retention, saturation, Experts) and the stale-data SLA.
4. Gross profit on Cost to Serve (needs a delivery-cost column from finance), Salesforce activity as the effort signal, and an Axonify-wide industry benchmark (not in DataConnect).
