// Recomputes the headline numbers straight from BigQuery (a different route from the dashboard queries) and compares
// them with the dashboard data. Run after a sync or a query change: `npm run reconcile`.
//   --tenant=324,352   limit to some tenants
//   --snapshot         compare the snapshots stored in Postgres (what the pages show) instead of freshly built data
// Exit code 1 when any check fails. Reads BigQuery only; nothing is written.
import { existsSync, readFileSync } from "node:fs";
import { BigQuery } from "@google-cloud/bigquery";
import { bqConfig, fetchDashboards, runQuery } from "../src/server/dashboard/bigquery/load";
import { compareAtMost, compareValue, invariantChecks, referenceIsFresh, summarize, type Check, type Reference } from "../src/server/dashboard/reconcile";
import type { DashboardData } from "../src/server/dashboard/types";
import { joinDashboard, SECTION_NAMES, type DashboardCore, type Section } from "../src/server/dashboard/sections";

type Rows = Record<string, unknown>[];
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const num = (v: unknown) => {
  const x = v && typeof v === "object" && "value" in (v as object) ? (v as { value: unknown }).value : v;
  const n = Number(x);
  return x == null || !Number.isFinite(n) ? null : n;
};

async function main() {
  const cfg = bqConfig();
  if (!cfg || cfg.tenants.length === 0) {
    console.error("Set BQ_PROJECT_ID and BQ_TENANT_IDS first.");
    process.exitCode = 1;
    return;
  }
  const only = arg("tenant")?.split(",").map(Number).filter(Boolean);
  const tenants = cfg.tenants.filter((t) => !only || only.includes(t));
  const P = (v: string) => `\`${cfg.project}.${cfg.dataset}.${v}\``;
  const bq = new BigQuery({ projectId: cfg.project });
  const q = async (sql: string) => (await bq.query({ query: sql, params: { t: tenants }, types: { t: ["INT64"] } }))[0] as Rows;

  const names = new Map((await runQuery(cfg, "clients", tenants)).map((r) => [String(num(r.id)), String(r.name)]));
  let dashboards: Map<string, DashboardData>;
  if (process.argv.includes("--snapshot")) {
    const { db } = await import("../src/server/db");
    const snaps = await db.syncDashboard.findMany({ where: { clientId: { in: tenants.map(String) } } });
    const parts = await db.syncDashboardPart.findMany({ where: { clientId: { in: tenants.map(String) } } });
    dashboards = new Map(snaps.map((s) => {
      const mine: Partial<Record<Section, Record<string, unknown>>> = {};
      for (const p of parts) if (p.clientId === s.clientId) mine[p.section as Section] = p.payload as Record<string, unknown>;
      return [s.clientId, joinDashboard(s.payload as unknown as DashboardCore, mine, SECTION_NAMES)];
    }));
    await db.$disconnect();
    console.log(`Comparing ${dashboards.size} stored snapshot(s) with BigQuery.`);
  } else {
    const res = await fetchDashboards(cfg, tenants.map((t) => ({ tenantId: t, clientId: String(t), name: names.get(String(t)) ?? String(t) })));
    if (res.status !== "ok") {
      console.error(res.reason);
      process.exitCode = 1;
      return;
    }
    dashboards = res.data;
    console.log(`Comparing freshly built data for ${dashboards.size} tenant(s) with BigQuery.`);
  }

  // Independent recomputation: distinct users from the user-level view, row averages, record counts, 30-day event counts.
  const [users, scores, progress, logins, trains] = await Promise.all([
    q(`SELECT tenant_id, FORMAT_DATE('%Y-%m', month) AS month,
         COUNT(DISTINCT IF(user_is_active, user_id, NULL)) AS active,
         COUNT(DISTINCT IF(user_is_active AND total_sessions_30_day > 0, user_id, NULL)) AS logged_in,
         COUNT(DISTINCT IF(user_is_active AND training_sessions_30_day > 0, user_id, NULL)) AS training
       FROM ${P("foundation_user_monthly_participation")}
       WHERE tenant_id IN UNNEST(@t) AND month >= DATE_SUB(DATE_TRUNC(CURRENT_DATE(), MONTH), INTERVAL 2 MONTH) GROUP BY 1, 2`),
    q(`SELECT tenant_id, AVG(current_score) AS cur, AVG(baseline_score) AS base FROM ${P("analytics_SDE_topic_progress")}
       WHERE tenant_id IN UNNEST(@t) AND LOWER(user_status) = 'active' AND current_score IS NOT NULL AND baseline_score IS NOT NULL GROUP BY 1`),
    q(`SELECT tenant_id, COUNT(*) AS n FROM ${P("content_user_topic_progress")}
       WHERE tenant_id IN UNNEST(@t) AND is_active = TRUE AND question_level IN (1, 2, 3)
         AND LOWER(topic_progress) IN ('not started', 'beginner', 'intermediate', 'graduate', 'expert') GROUP BY 1`),
    q(`SELECT tenant_id, COUNT(*) AS n FROM ${P("foundation_user_login_record")}
       WHERE tenant_id IN UNNEST(@t) AND DATE(create_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) GROUP BY 1`),
    q(`SELECT tenant_id, COUNT(*) AS n FROM ${P("content_user_training")}
       WHERE tenant_id IN UNNEST(@t) AND DATE(create_date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) AND status NOT IN ('Deleted', 'Cancelled') GROUP BY 1`),
  ]);

  const checks: Check[] = [];
  for (const t of tenants) {
    const label = `${names.get(String(t)) ?? t} (${t})`;
    const d = dashboards.get(String(t));
    if (!d) {
      checks.push({ tenant: label, name: "dashboard exists", status: "fail", note: "no dashboard data for this tenant" });
      continue;
    }
    checks.push(...invariantChecks(label, d));

    const mine = (rows: Rows) => rows.find((r) => num(r.tenant_id) === t);
    const latest = d.months.at(-1);
    const u = users.find((r) => num(r.tenant_id) === t && String(r.month) === latest?.month);
    // The dashboard counts come from the team view, which covers Axonify's default population (users in active training
    // programs). The user-level view covers every user, so it is an upper bound, equal for clients whose users are all in programs.
    checks.push(compareAtMost(label, `active users ${latest?.month} (<= all users)`, latest?.activeUsers, num(u?.active), { abs: 5 }));
    checks.push(compareAtMost(label, `logged-in users ${latest?.month} (<= all users)`, latest?.loggedInUsers, num(u?.logged_in), { abs: 3 }));
    checks.push(compareAtMost(label, `training users ${latest?.month} (<= all users)`, latest?.trainingUsers, num(u?.training), { abs: 3 }));

    const s = mine(scores);
    checks.push(compareValue(label, "current knowledge", d.knowledge.current, s ? num(s.cur)! / 100 : null, { abs: 0.002 }));
    checks.push(compareValue(label, "baseline knowledge", d.knowledge.baseline, s ? num(s.base)! / 100 : null, { abs: 0.002 }));

    const records = d.progress.reduce((sum, p) => sum + Object.values(p.counts).reduce((a, b) => a + b, 0), 0);
    checks.push(compareValue(label, "user-topic-level records", records, num(mine(progress)?.n) ?? 0, { abs: 50, rel: 0.002 }));
    checks.push(compareValue(label, "logins last 30 days", d.platformAccess.reduce((a, p) => a + p.logins, 0), num(mine(logins)?.n) ?? 0, { abs: 20, rel: 0.02 }));
    checks.push(compareValue(label, "training activities last 30 days (by hour)", d.hours.reduce((a, h) => a + h.count, 0), num(mine(trains)?.n) ?? 0, { abs: 20, rel: 0.02 }));
  }

  // Figures typed from Axonify AdminZone, kept in config/axonify-reference.json; skipped when too old to be comparable.
  const refFile = "config/axonify-reference.json";
  if (existsSync(refFile)) {
    const refs = (JSON.parse(readFileSync(refFile, "utf8")) as { references: Reference[] }).references;
    for (const ref of refs.filter((r) => tenants.includes(r.tenantId))) {
      const d = dashboards.get(String(ref.tenantId));
      const label = `${names.get(String(ref.tenantId)) ?? ref.tenantId} (${ref.tenantId})`;
      if (!d) continue;
      if (!referenceIsFresh(ref, new Date())) {
        checks.push({ tenant: label, name: `AdminZone reference from ${ref.capturedOn}`, status: "skip", note: "older than 3 days; recapture to use it" });
        continue;
      }
      const latest = d.months.at(-1);
      const actual: Record<string, number | null | undefined> = {
        employees: latest?.activeUsers, loggedIn: latest?.loggedInUsers, completedTraining: latest?.trainingUsers, frequencyDays: latest?.frequency,
        currentKnowledge: d.knowledge.current == null ? null : d.knowledge.current * 100,
      };
      for (const [k, v] of Object.entries(ref.values)) checks.push(compareValue(label, `AdminZone ${k}`, actual[k], v.value, { abs: v.abs, rel: v.rel }));
    }
  }

  for (const c of checks.filter((x) => x.status !== "pass")) {
    const vals = c.actual != null || c.expected != null ? `  actual=${c.actual} expected=${c.expected}` : "";
    console.log(`${c.status === "fail" ? "FAIL" : "skip"}  ${c.tenant.padEnd(28)} ${c.name}${vals}${c.note ? `  (${c.note})` : ""}`);
  }
  const sum = summarize(checks);
  console.log(`\n${sum.pass} passed, ${sum.fail} failed, ${sum.skip} skipped across ${tenants.length} tenant(s).`);
  process.exitCode = sum.ok ? 0 : 1;
}

void main();
