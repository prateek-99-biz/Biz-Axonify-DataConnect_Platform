# Salesforce Data Request

A request you can send to whoever looks after Salesforce. It asks for one spreadsheet, one row per client, that an admin then loads into the
dashboard in **Settings → Salesforce Accounts**. It feeds the CSM pages, renewals, licence utilization and the industry benchmark.

## What To Ask For

One row for every client that has an Axonify site, saved as a CSV file with these columns, in any order:

| Column | What it is | Format | Example | Required |
|---|---|---|---|---|
| `client_id` | The Axonify site ID. It is the number shown next to each client in the dashboard. **Do not change it.** | Text or number | `384` | Yes |
| `client_name` | The client's name, for reference only. | Text | `Adidas` | No |
| `salesforce_account_id` | The Salesforce Account ID. | 15 or 18 characters | `0012w00000AbCdEAAV` | Yes |
| `industry` | The account's industry in Salesforce. | Text | `Retail` | Yes |
| `region` | Sales region or territory. | Text | `GCC` | No |
| `csm_name` | The Customer Success Manager who owns the account. | Text | `Sarah K.` | Yes |
| `csm_email` | That person's work email. It decides whose accounts they see when they sign in. | Email | `sarah.k@bizgroup.ae` | Yes |
| `licenses` | Number of licences, or seats, the client has bought. | Whole number, no commas | `800` | Yes |
| `license_value` | **Annual** contract value for the current term. | Number, no symbol or commas | `12000` | Yes |
| `currency` | Currency of `license_value`. | Three letters | `USD` or `AED` | Yes |
| `contract_start` | When the current contract term began. | `YYYY-MM-DD` | `2025-01-01` | Yes |
| `renewal_date` | When the current term ends and the client must renew. | `YYYY-MM-DD` | `2026-12-31` | Yes |

## Rules For The Amounts

- **One annual figure per client.** If the contract is multi-year, give the yearly amount, not the total. If it is billed monthly, give the monthly amount times twelve.
- **One currency per row.** Do not convert; give the contract's own currency in `currency`. Different rows may use different currencies.
- **Numbers only.** `12000`, not `$12,000` and not `12k`. A decimal point is fine: `12500.50`.
- **Recurring licence revenue only.** Leave out one-off services, implementation fees and training days.
- **Current contract, not the pipeline.** `renewal_date` is when the current term ends, not an opportunity close date.
- **Dates as `YYYY-MM-DD`.** Excel may turn them into `31/12/2026`; format the column as Text before saving.
- **Blank is fine** for anything unknown, except `client_id`. A blank cell leaves that detail empty rather than wrong.

## What It Should Look Like

| client_id | client_name | salesforce_account_id | industry | region | csm_name | csm_email | licenses | license_value | currency | contract_start | renewal_date |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 101 | Example Pharmacy Group | 0012w00000AAAAAAAA | Retail | GCC | Sarah K. | sarah.k@bizgroup.ae | 800 | 12000 | USD | 2025-01-01 | 2026-12-31 |
| 102 | Example Airline | 0012w00000BBBBBBBB | Aviation | GCC | Mohamed R. | mohamed.r@bizgroup.ae | 500 | 8500 | USD | 2025-09-01 | 2026-09-01 |
| 103 | Example Bank | 0012w00000CCCCCCCC | Banking | UAE | Sarah K. | sarah.k@bizgroup.ae | 350 | 19100 | AED | 2024-07-01 | 2026-07-01 |

The same three rows are in `docs/salesforce-accounts.sample.csv`. A starting file with every client's ID and name already filled in
downloads from **Settings → Salesforce Accounts → Download CSV**.

## Message To Send

> Hi, we are building a customer success dashboard that combines Axonify usage with Salesforce account data. Could you send one
> spreadsheet with one row per client that has an Axonify site? The columns are client ID, Salesforce Account ID, industry, region,
> CSM name and email, number of licences, annual licence value with its currency, and the current contract's start and end dates.
> Amounts should be the yearly recurring licence value for the current term, as plain numbers, and dates written YYYY-MM-DD. I've
> attached a template with the client IDs and names filled in, so you only need to add the Salesforce details. Please tell me which
> Salesforce field you used for the CSM.

## Questions Worth Asking Back

- Which field holds the **CSM**? It is often a custom field rather than the Account Owner.
- Is the licence count the **purchased** seats or the **active** seats?
- Do any clients have **more than one contract** at once? The dashboard holds one renewal date per client.

## Not From Salesforce

Cost to serve (CSM and technical hours, cost per hour) is not in Salesforce. It needs a time-tracking source, so it is a separate request.
