// Recounts the monthly feature and Max usage straight from BigQuery, one source table at a time and without the sync's
// `clientMonthly` query, and compares it with what the Insights pages show (SyncClientMonth in Postgres). Then recomputes the
// Insights and leaderboard figures for a whole year in SQL and compares them with the app's own calculation.
//   npm run reconcile:usage                 last three complete months, every tenant
//   npm run reconcile:usage -- --tenant=290 limit to some tenants
// Run straight after a refresh: the stored rows are a snapshot, so later activity in BigQuery shows as differences.
// Exit code 1 when any check fails. Reads only; nothing is written.
import { bigQueryClient } from "../src/server/google/bigquery-client";
import { bqConfig, runQuery } from "../src/server/dashboard/bigquery/load";
import { compareAtMost, compareValue, summarize, type Check } from "../src/server/dashboard/reconcile";
import { usageFor } from "../src/server/metrics/features";
import type { ClientMonthRow } from "../src/server/data/ports";

type Rows = Record<string, unknown>[];
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const num = (v: unknown) => {
  const x = v && typeof v === "object" && "value" in (v as object) ? (v as { value: unknown }).value : v;
  const n = Number(x);
  return x == null || !Number.isFinite(n) ? null : n;
};

/** The last `n` complete calendar months, oldest first, as YYYY-MM. */
function completeMonths(n: number, today = new Date()): string[] {
  const out: string[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

async function main() {
  const cfg = bqConfig();
  if (!cfg || cfg.tenants.length === 0) {
    console.error("Set BQ_PROJECT_ID and BQ_TENANT_IDS first.");
    process.exitCode = 1;
    return;
  }
  const only = arg("tenant")?.split(",").map(Number).filter(Boolean);
  const tenants = cfg.tenants.filter((t) => !only || only.includes(t));
  const months = completeMonths(3);
  const from = `${months[0]}-01`;
  const P = (v: string) => `\`${cfg.project}.${cfg.dataset}.${v}\``;
  const bq = await bigQueryClient(cfg.project);
  const q = async (sql: string) => (await bq.query({ query: sql, params: { t: tenants, from }, types: { t: ["INT64"], from: "STRING" } }))[0] as Rows;
  const M = (col: string) => `FORMAT_DATE('%Y-%m', DATE(${col}))`;
  // The date goes in as text and is converted in SQL: the client silently matches nothing when a plain string is typed as DATE.
  const WINDOW = (col: string) => `DATE(${col}) >= DATE(@from) AND DATE(${col}) < DATE_TRUNC(CURRENT_DATE(), MONTH)`;

  const names = new Map((await runQuery(cfg, "clients", tenants)).map((r) => [String(num(r.id)), String(r.name)]));
  const { db } = await import("../src/server/db");
  const stored = (await db.syncClientMonth.findMany({ where: { clientId: { in: tenants.map(String) } } })) as ClientMonthRow[];
  const lastRun = await db.syncRun.findFirst({ where: { status: "ok" }, orderBy: { finishedAt: "desc" } });
  await db.$disconnect();
  console.log(`Recounting ${months.join(", ")} for ${tenants.length} tenant(s). Stored rows from the refresh at ${lastRun?.finishedAt?.toISOString() ?? "unknown"}.`);

  // One plain query per source: no CTEs shared with the sync, so a mistake in its query cannot repeat here.
  const [people, max, grounded, reach, chat, games, time] = await Promise.all([
    q(`SELECT tenant_id, FORMAT_DATE('%Y-%m', month) AS month,
         COUNT(DISTINCT IF(user_is_active, user_id, NULL)) AS active,
         COUNT(DISTINCT IF(user_is_active AND total_sessions_30_day > 0, user_id, NULL)) AS logged_in,
         COUNT(DISTINCT IF(user_is_active AND training_sessions_30_day > 0, user_id, NULL)) AS training
       FROM ${P("foundation_user_monthly_participation")} WHERE tenant_id IN UNNEST(@t) AND ${WINDOW("month")} GROUP BY 1, 2`),
    q(`SELECT tenant_id, ${M("create_date")} AS month, COUNT(*) AS queries, COUNT(DISTINCT user_id) AS askers,
         COUNTIF(feedback IS NOT NULL AND TRIM(feedback) != '') AS rated, COUNTIF(STARTS_WITH(LOWER(feedback), 'thumbs-down')) AS negative
       FROM ${P("max_user_query")} WHERE tenant_id IN UNNEST(@t) AND ${WINDOW("create_date")} GROUP BY 1, 2`),
    q(`SELECT q.tenant_id, ${M("q.create_date")} AS month, COUNT(*) AS grounded
       FROM ${P("max_user_query")} q
       WHERE q.tenant_id IN UNNEST(@t) AND ${WINDOW("q.create_date")}
         AND EXISTS (SELECT 1 FROM ${P("max_response_sources")} s WHERE s.tenant_id = q.tenant_id AND s.user_query_id = q.id)
       GROUP BY 1, 2`),
    q(`SELECT tenant_id, ${M("create_date")} AS month, COUNT(DISTINCT user_id) AS users
       FROM ${P("comms_user_message_impression")} WHERE tenant_id IN UNNEST(@t) AND ${WINDOW("create_date")} GROUP BY 1, 2`),
    q(`SELECT tenant_id, ${M("create_date")} AS month, COUNT(*) AS messages, COUNT(DISTINCT user_id) AS users
       FROM ${P("chat_user_message")} WHERE tenant_id IN UNNEST(@t) AND delete_date IS NULL AND ${WINDOW("create_date")} GROUP BY 1, 2`),
    q(`SELECT tenant_id, ${M("create_date")} AS month, COUNT(*) AS plays
       FROM ${P("game_play")} WHERE tenant_id IN UNNEST(@t) AND is_game_played = TRUE AND status NOT IN ('Deleted', 'Cancelled') AND ${WINDOW("create_date")} GROUP BY 1, 2`),
    q(`SELECT tenant_id, FORMAT_DATE('%Y-%m', date) AS month, SUM(CASE WHEN seconds >= 0 AND seconds <= 86400 THEN seconds ELSE 0 END) AS seconds -- a user-day over 24 hours is a broken record
       FROM ${P("foundation_user_daily_time_spent")} WHERE tenant_id IN UNNEST(@t) AND ${WINDOW("date")} GROUP BY 1, 2`),
  ]);

  const pick = (rows: Rows, t: number, m: string) => rows.find((r) => num(r.tenant_id) === t && String(r.month) === m);
  const checks: Check[] = [];
  const exact = { abs: 0 };
  for (const t of tenants) {
    const label = `${names.get(String(t)) ?? t} (${t})`;
    for (const m of months) {
      const s = stored.find((r) => r.clientId === String(t) && r.month === m);
      const p = pick(people, t, m);
      if (!s && !p) continue;
      const v = (row: Record<string, unknown> | undefined, k: string) => num(row?.[k]) ?? 0;
      const add = (name: string, actual: number | undefined, expected: number, tol = exact) => checks.push(compareValue(label, `${m} ${name}`, actual ?? null, expected, tol));
      add("active users", s?.activeUsers, v(p, "active"));
      add("logged-in users", s?.loggedInUsers, v(p, "logged_in"));
      add("training users", s?.trainingUsers, v(p, "training"));
      const mx = pick(max, t, m);
      add("Max questions", s?.maxQueries, v(mx, "queries"));
      add("Max askers", s?.maxUsers, v(mx, "askers"));
      add("Max answers citing client content", s?.maxGrounded, v(pick(grounded, t, m), "grounded"));
      add("Max rated answers", s?.maxRated, v(mx, "rated"));
      add("Max thumbs-down", s?.maxNegative, v(mx, "negative"));
      add("broadcast readers", s?.commsReachUsers, v(pick(reach, t, m), "users"));
      add("chat messages", s?.chatMessages, v(pick(chat, t, m), "messages"));
      add("chat users", s?.chatUsers, v(pick(chat, t, m), "users"));
      add("games played", s?.gamesPlayed, v(pick(games, t, m), "plays"));
      add("learning seconds", s?.learningSeconds, v(pick(time, t, m), "seconds"));
      if (s) {
        // Rules that hold whatever the data: a part is never bigger than its whole.
        checks.push(compareAtMost(label, `${m} logged-in <= active`, s.loggedInUsers, s.activeUsers));
        checks.push(compareAtMost(label, `${m} training <= active`, s.trainingUsers, s.activeUsers));
        checks.push(compareAtMost(label, `${m} Max askers <= questions`, s.maxUsers, s.maxQueries));
        checks.push(compareAtMost(label, `${m} grounded <= questions`, s.maxGrounded, s.maxQueries));
        checks.push(compareAtMost(label, `${m} rated <= questions`, s.maxRated, s.maxQueries));
        checks.push(compareAtMost(label, `${m} thumbs-down <= rated`, s.maxNegative, s.maxRated));
      }
    }
  }

  // The app's derived figures (Insights pages and the leaderboard) for the last full year, against the same ratios in SQL.
  const year = new Date().getUTCFullYear() - 1;
  const yearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const sqlYear = await q(`
    WITH a AS (
      SELECT tenant_id, FORMAT_DATE('%Y-%m', month) AS month,
        COUNT(DISTINCT IF(user_is_active, user_id, NULL)) AS active,
        COUNT(DISTINCT IF(user_is_active AND total_sessions_30_day > 0, user_id, NULL)) AS logged_in
      FROM ${P("foundation_user_monthly_participation")} WHERE tenant_id IN UNNEST(@t) AND EXTRACT(YEAR FROM month) = ${year} GROUP BY 1, 2),
    m AS (
      SELECT tenant_id, ${M("create_date")} AS month, COUNT(*) AS queries, COUNT(DISTINCT user_id) AS askers
      FROM ${P("max_user_query")} WHERE tenant_id IN UNNEST(@t) AND EXTRACT(YEAR FROM create_date) = ${year} GROUP BY 1, 2)
    SELECT a.tenant_id, SUM(a.active) AS active, SUM(a.logged_in) AS logged_in, SUM(COALESCE(m.queries, 0)) AS queries, SUM(COALESCE(m.askers, 0)) AS askers
    FROM a LEFT JOIN m USING (tenant_id, month) GROUP BY 1`);
  for (const t of tenants) {
    const label = `${names.get(String(t)) ?? t} (${t})`;
    const r = sqlYear.find((x) => num(x.tenant_id) === t);
    const rows = stored.filter((x) => x.clientId === String(t));
    if (!r || rows.length === 0) continue;
    const u = usageFor(rows, yearMonths);
    const active = num(r.active)!;
    const ratio = (a: number | null, b: number) => (b > 0 && a != null ? a / b : null);
    const tol = { abs: 0.0005 };
    checks.push(compareValue(label, `${year} engagement (logged in / active)`, u.engagement, ratio(num(r.logged_in), active), tol));
    checks.push(compareValue(label, `${year} Max adoption`, u.maxAdoption, ratio(num(r.askers), active), tol));
    checks.push(compareValue(label, `${year} Max questions per 100 users`, u.maxPer100, active > 0 ? (100 * num(r.queries)!) / active : null, { abs: 0.05 }));
    checks.push(compareValue(label, `${year} Max questions`, u.maxQueries, num(r.queries), exact));
  }

  for (const c of checks.filter((x) => x.status !== "pass")) {
    const vals = c.actual != null || c.expected != null ? `  stored=${c.actual} recount=${c.expected}` : "";
    console.log(`${c.status === "fail" ? "FAIL" : "skip"}  ${c.tenant.padEnd(26)} ${c.name}${vals}${c.note ? `  (${c.note})` : ""}`);
  }
  const sum = summarize(checks);
  console.log(`\n${sum.pass} passed, ${sum.fail} failed, ${sum.skip} skipped across ${tenants.length} tenant(s).`);
  process.exitCode = sum.ok ? 0 : 1;
}

void main();
