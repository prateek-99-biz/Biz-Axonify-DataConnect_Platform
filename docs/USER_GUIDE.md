# User Guide

For the Biz Group team and anyone given access. The same explanations are inside the dashboard under **How It Works** and **What the Metrics Mean**.

## Signing in
Open the dashboard address and sign in with your work email. First time: use the link in your invitation email to set a password (10 or more characters, letters and numbers). Forgot it? Use **Forgot Password** on the sign-in page.

## Who sees what
| Role | Sees |
|---|---|
| Admin | Everything, plus Settings (users, Salesforce data, sample data) and Refresh Data |
| Member | All analysis and internal pages, notes, tasks, CSV export |
| Client | Only the quarterly review pages for their own client |

After sign-in, a Customer Success Manager whose email matches the CSM column of the Salesforce data lands on **My Accounts**. Everyone else lands on **Portfolio**.

## The menu
| Group | Page | Use it to |
|---|---|---|
| Analyse | Portfolio | See every client at a glance: health, participation, knowledge, what changed |
| | Clients | Open a client profile (health history, tasks, notes) |
| | Compare Clients | Put clients side by side, quarter by quarter |
| | Client Dashboards | The ten quarterly review pages for one client |
| Internal | Internal Home | Every internal page on one screen |
| | My Accounts | One CSM's accounts: this week's agenda, renewal timeline, an account card each |
| | Alerts and Watchlist | Who needs a conversation now, and why |
| | Renewals | Contracts coming up (30, 60, 90, 180, 365 days or all) with their value |
| Admin | Data Reliability | Sync history, data checks, how old the data is |
| | Settings | Users and Salesforce data |
| Help | How It Works, What the Metrics Mean | Plain-language explanations |

Pages that take one client show a client filter; pages that do not, do not.

## Reading the numbers
- **Health** = half participation (people who trained out of people who were active) and half knowledge. Bands: Healthy 75 or more, Moderate 60, At Risk 45, Critical below 45. The number shown is rounded down, so a 44.7 reads 44 and is Critical.
- **Data to date.** The current quarter is partial. While it is under half over, "declining" flags are held back. Past quarters are complete.
- **Check Data.** An account with many registered users and almost nobody active is shown as Check Data rather than as a real score. Look at the Axonify site setup first.
- **Knowledge** exists for the latest quarter only; earlier quarters carry it forward.
- Full definitions: **What the Metrics Mean**, and [PROJECT_SCOPE.md](../PROJECT_SCOPE.md) section 5.

## Everyday tasks
**Check my accounts (CSM).** Open My Accounts. The top strip is your book (accounts, health mix, renewal value). *This Week* lists what to do. Each card shows health, trend, renewal and open tasks. Use the picker to look at a colleague's accounts.

**Acknowledge an alert.** Alerts and Watchlist, then Acknowledge. It is stored against your name.

**Add a note or task.** Open the client's profile.

**Export.** Tables have a CSV button.

**Refresh the data (admin).** Press **Refresh Data** in the top bar and wait about a minute. It will not run twice in a minute. If it says Google access is needed, see [DATA_REFRESH.md](DATA_REFRESH.md).

**Add a user (admin).** Settings, User Management, Add User. They receive an email link. Admin and Member need a @bizgroup.ae address; Client needs a client chosen.

**Load Salesforce data (admin).** Settings, Salesforce Accounts: Import a CSV (format in [salesforce-data-request.md](salesforce-data-request.md)); Download CSV gives the current table. This feeds CSM names, renewals, licences and industry.

**Sample data.** Settings, Sample Data: Load Sample Data fills the CSM pages with clearly marked fake accounts for demos; **Remove Sample Data** deletes only those rows. Sample rows are labelled on screen. Remove them once real Salesforce data is imported.

## When something looks wrong
| You see | Likely reason |
|---|---|
| "Data is N days old" banner | The last refresh failed or has not run. Admin: see DATA_REFRESH.md |
| Check Data on an account | Almost nobody active against a large registered base; check the Axonify site |
| A flat or empty Knowledge line | Knowledge is only for the latest quarter |
| A client with no CSM or renewal | No Salesforce row for that client yet |
| Numbers differ from AdminZone | Different names (see What the Metrics Mean) and the partial current quarter |
