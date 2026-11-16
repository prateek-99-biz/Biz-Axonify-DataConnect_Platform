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
- **On Vercel** there is no Google sign-in, so it fails until the app has an identity of its own (below). It cannot open a login page there: a Vercel function has no browser and no gcloud. Once Option B is set up the button works there too.

## The daily refresh on Vercel
The code for this is in place and stays switched off until the Google setup in Option B exists.
- `vercel.json` asks Vercel to call `/api/cron/sync` once a day at 22:00 UTC (02:00 in Dubai). On the Hobby plan Vercel may start it any time within that hour.
- The route only answers a caller that sends `CRON_SECRET`, which Vercel's scheduler does by itself. Without `CRON_SECRET` it is closed to everyone.
- It runs the same sync as everything else, records the run as `vercel-cron` on the Data Reliability page, and answers with an error status when the sync fails, so the failure shows in Vercel under Cron Jobs.
- **Settings, Configuration Status** shows two rows for this: *Google Sign-In for Refresh* and *Scheduled Daily Refresh*.

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
2. Add four variables for Production. None is a secret; they only say where to sign in. Set all four or none: a half-filled set is reported as an error so a typo cannot fall back to the wrong identity.

   | Variable | Value |
   |---|---|
   | `GCP_PROJECT_NUMBER` | The Google project's number (digits), not its name |
   | `GCP_WORKLOAD_IDENTITY_POOL_ID` | The pool created in step 4 |
   | `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | The provider created in step 4 |
   | `GCP_SERVICE_ACCOUNT_EMAIL` | The service account from step 2 |

3. Add `CRON_SECRET`: long random text, marked Sensitive. This switches the daily refresh on.
4. Check `BQ_PROJECT_ID`, `BQ_DATASET` and `BQ_TENANT_IDS` are set for Production, then redeploy.
5. Test: Settings shows both rows as OK; press **Refresh Data** on the live site; then look at Vercel, Cron Jobs after the next 22:00 UTC.

**Code (built)**
- `src/server/google/bigquery-client.ts` makes every BigQuery client. With the four `GCP_` variables it signs in through Vercel's token (`@vercel/oidc` and `google-auth-library`); without them it uses the machine's own Google sign-in, so the laptop scripts are unchanged.
- `src/app/api/cron/sync/route.ts` is the scheduled route, and `vercel.json` holds the schedule.
- Both sync routes allow up to 300 seconds. A sync takes about a minute. If a run is cut off at 60 seconds, the Vercel project is not using Fluid Compute (Project Settings, Functions), which is what allows more on the Hobby plan.

**If the Google setup is refused**
The same keyless sign-in works from a GitHub Actions schedule running `npm run sync`, with GitHub as the identity provider in step 4 instead of Vercel. That route has no time limit.

## Troubleshooting
| Message | Meaning and fix |
|---|---|
| `gcloud is not installed` | Install the Google Cloud CLI, open a new window |
| `invalid_rapt`, `invalid_grant`, `reauth` | The sign-in expired. `npm run sync:now` |
| `Sync is already running` or cooldown | Wait a minute |
| Source returned nothing | The sync keeps the old data on purpose; check Data Reliability |
| `half configured. Missing: GCP_...` | Only some of the four `GCP_` variables are set in Vercel. Set the ones named |
| Cron job shows 503 in Vercel | `CRON_SECRET` is not set |
| Cron job shows 500, message about permission or audience | The Google side does not match: check the pool, provider and service-account names, and that OIDC Federation is on |
