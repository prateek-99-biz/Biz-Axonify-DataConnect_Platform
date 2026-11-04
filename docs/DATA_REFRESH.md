# Refreshing the Data

The dashboard never queries BigQuery when you click. A sync copies the latest figures from Axonify DataConnect (BigQuery) into the dashboard's own database. This page covers running it, scheduling it, and why it needs a Google identity.

## What a sync needs
BigQuery access for whoever runs it. Today that is a person's Google sign-in on the machine running the sync (`gcloud auth application-default login`). That sign-in **expires** (Google's reauthentication policy, error `invalid_rapt`), typically within a day, and it cannot be renewed without a person approving in the browser.

## Run it by hand (your laptop)
| Command | What it does |
|---|---|
| `npm run sync:now` | Checks the Google sign-in; opens the Google page only if it has expired; then syncs. Retries once if Google rejects the sign-in mid-run |
| `npm run sync:now -- -Login` | Always sign in first |
| `npm run sync:now -- -CheckOnly` | Only checks gcloud and the sign-in. Changes nothing |
| `npm run sync:now -- -NoLogin` | Never opens a browser (what the nightly task uses) |
| `scripts\Refresh Data.cmd` | The same as `sync:now`, by double-click |
| `npm run sync` | The bare sync, no sign-in help |

You approve the Google page yourself; the scripts never type credentials.

## Schedule it on your laptop (Windows Task Scheduler)
| Command | What it sets up |
|---|---|
| `npm run sync:schedule` | A nightly refresh (default 00:00, `-Time 02:30` to change). Never opens a browser; logs to `logs\sync.log` |
| `npm run sync:schedule -- -Morning` | Adds a weekday 09:00 check (`-MorningTime 08:30`) that opens the Google sign-in when it has expired, so one click keeps things going |
| `npm run sync:schedule -- -Remove` | Removes both tasks |

Limits: the laptop must be on and you signed in to Windows (a missed run happens when it next starts). A nightly run succeeds only while the stored sign-in is still valid; otherwise it fails, writes why to the log, and the dashboard shows its stale-data banner until the next sign-in.

## The Refresh Data button
- Admin only; same sync; 60 second cooldown; one run at a time; a failure leaves the old data untouched.
- **On localhost** it uses the Google sign-in on that machine.
- **On Vercel** there is no Google sign-in, so it fails until the app has an identity of its own (below). It cannot open a login page there: a Vercel function has no browser and no gcloud.

## Making it unattended (needs a Google Cloud admin)
| Option | What | Notes |
|---|---|---|
| A. Reauth exemption | An admin exempts the sign-in (or the account) from the reauthentication policy | Least change; laptop still must be on |
| B. Workload Identity Federation (recommended for Vercel) | Vercel proves its identity with a short-lived token; Google lets that token act as a read-only service account | No key file, no sign-in. Steps below |
| C. Service-account key | Key stored as a Vercel environment variable | Needs the organisation's key-creation block lifted |
| D. Cloud Run job | Runs the sync inside Google Cloud | Most setup |

### Option B, steps
**Google Cloud (admin)**
1. Enable the *IAM Service Account Credentials API* and the *Security Token Service API*.
2. Create a service account, for example `biz-dash-sync`.
3. Grant it *BigQuery Job User* on the project and *BigQuery Data Viewer* on the Axonify dataset (read only).
4. Create a Workload Identity Pool and an OIDC provider: issuer `https://oidc.vercel.com/<team-slug>`, allowed audience `https://vercel.com/<team-slug>`, mapping `google.subject = assertion.sub`, and a condition limiting it to this project's production environment.
5. Grant *Workload Identity User* on the service account to the pool's principal (`principalSet://iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/<pool>/*`).
6. If the organisation restricts external identity providers, allow `oidc.vercel.com`.

**Vercel**
1. Project Settings, Security: turn on OIDC Federation.
2. Add `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`.

**Code (not built yet)**
A credentials helper using `@vercel/oidc` and `google-auth-library` for the four `new BigQuery(...)` calls; a `/api/cron/sync` route guarded by `CRON_SECRET` with a `vercel.json` cron; `maxDuration` for the function (a sync takes about a minute, and Vercel's Hobby plan caps functions at 60 seconds). Test on a preview deployment first.

## Troubleshooting
| Message | Meaning and fix |
|---|---|
| `gcloud is not installed` | Install the Google Cloud CLI, open a new window |
| `invalid_rapt`, `invalid_grant`, `reauth` | The sign-in expired. `npm run sync:now` |
| `Sync is already running` or cooldown | Wait a minute |
| Source returned nothing | The sync keeps the old data on purpose; check Data Reliability |
