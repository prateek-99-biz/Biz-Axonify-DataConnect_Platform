import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QUERIES, buildSql, viewsIn, type QueryName } from "./queries";
import { aggregateMonths } from "../calc";
import { assembleDashboard, norm01, norm100, teamPath, type RowSet } from "./assemble";

const schema = JSON.parse(readFileSync("config/bigquery-schema.json", "utf8")) as { dataset: string; tables: Record<string, Record<string, string>> };
const src = { project: "proj", dataset: schema.dataset };
const names = Object.keys(QUERIES) as QueryName[];

describe("queries against the DataConnect schema", () => {
  it("reads only views that exist", () => {
    for (const n of names) {
      for (const v of viewsIn(buildSql(n, src))) expect(schema.tables, `${n} reads unknown view ${v}`).toHaveProperty(v);
    }
  });

  it("uses columns that exist on the views it filters by tenant", () => {
    // Every query filters by tenant_id; each view it touches must have that column (tenant itself uses id).
    for (const n of names) {
      for (const v of viewsIn(buildSql(n, src))) {
        if (v === "tenant") continue;
        expect(Object.keys(schema.tables[v]), `${v} (used by ${n}) has no tenant_id`).toContain("tenant_id");
      }
    }
  });

  it("references qualified columns that exist", () => {
    // Checks `alias.column` for aliases bound to exactly one view in the query; aliases reused for CTEs are skipped.
    const problems: string[] = [];
    let checked = 0;
    for (const n of names) {
      const sql = buildSql(n, src);
      const bound = new Map<string, string | null>();
      const bind = (alias: string, target: string) => bound.set(alias, bound.has(alias) && bound.get(alias) !== target ? null : target);
      const stop = /^(ON|USING|WHERE|JOIN|LEFT|INNER|CROSS|GROUP|UNION|AS|SELECT|FULL|OUTER)$/i;
      for (const m of sql.matchAll(/(?:FROM|JOIN)\s+(?:`[^`.]+\.[^`.]+\.([^`.]+)`|([a-z_]+))\s+(?:AS\s+)?([a-z_]+)/gi)) {
        if (!stop.test(m[3])) bind(m[3], m[1] ?? `cte:${m[2]}`);
      }
      for (const m of sql.matchAll(/\b([a-z_]+)\.([a-z_0-9]+)\b/g)) {
        const view = bound.get(m[1]);
        if (view && !view.startsWith("cte:") && schema.tables[view]) {
          checked++;
          if (!(m[2] in schema.tables[view])) problems.push(`${n}: ${m[1]}.${m[2]} is not a column of ${view}`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(checked).toBeGreaterThan(50);
  });

  it("rejects unsafe identifiers", () => {
    expect(() => buildSql("clients", { project: "a`;DROP", dataset: "x" })).toThrow();
  });
});

describe("assembling a dashboard from rows", () => {
  const empty = (): RowSet => ({
    teamMonthly: [], knowledgeAccount: [], topics: [], frequency: [], progress: [], matrix: [], usageMonthly: [],
    platformAccess: [], hours: [], features: [], deliveryGroups: [], deliverySummary: [],
  });

  it("builds team trees from hierarchy strings and keeps the team as the leaf", () => {
    expect(teamPath("Dubai", "Retail > Dubai")).toEqual(["Retail", "Dubai"]);
    expect(teamPath("SAO PAULO", "Retail | AMERICAS | SAO PAULO")).toEqual(["Retail", "AMERICAS", "SAO PAULO"]);
    expect(teamPath("L&T/Ops", "L&T/Ops")).toEqual(["L&T/Ops"]);
    expect(teamPath("Admin", "")).toEqual(["Admin"]);
  });

  it("normalises scores given as 0-1 or 0-100", () => {
    expect(norm01(0.8)).toBe(0.8);
    expect(norm01(80)).toBe(0.8);
    expect(norm01(null)).toBeNull();
    expect(norm01(250)).toBe(1);
  });

  it("reads confidence on a 0-100 scale, including low scores", () => {
    expect(norm100(3)).toBe(0.03);
    expect(norm100(860)).toBe(1);
    expect(norm100(null)).toBeNull();
  });

  it("does not count roll-up team rows twice", () => {
    const rows = empty();
    const row = (team: string, h: string, n: number, tr: number) => ({ tenant_id: 1, month: "2026-10", team, team_hierarchy: h, active_users: n, logged_in_users: n, training_users: tr, frequency: 5, avg_time_per_day_min: 10 });
    rows.teamMonthly = [row("Retail", "Retail", 30, 12), row("AMERICAS", "Retail | AMERICAS", 10, 4), row("EUROPE", "Retail | EUROPE", 20, 8), row("SAO PAULO", "Retail | AMERICAS | SAO PAULO", 10, 4)];
    const d = assembleDashboard("1", "T", rows, "2026-10-22T00:00:00.000Z");
    expect(d.teams.map((t) => t.name)).toEqual(["Retail", "AMERICAS", "EUROPE", "SAO PAULO"]);
    expect(d.months[0]).toMatchObject({ activeUsers: 30, trainingUsers: 12 });
    // selecting a parent and its child must not add the child again
    const ids = new Map(d.teams.map((t) => [t.name, t.id]));
    const sel = d.teamMonths.filter((m) => [ids.get("AMERICAS"), ids.get("SAO PAULO")].includes(m.teamId));
    expect(aggregateMonths(sel, d.teams)[0]).toMatchObject({ activeUsers: 10, trainingUsers: 4 });
  });

  it("weights frequency and time by logged-in users, not all employees", () => {
    const rows = empty();
    const row = (team: string, n: number, li: number, f: number, t: number) => ({ tenant_id: 1, month: "2026-10", team, team_hierarchy: team, active_users: n, logged_in_users: li, training_users: 0, frequency: f, avg_time_per_day_min: t });
    rows.teamMonthly = [row("A", 900, 100, 10, 4), row("B", 100, 100, 20, 8), row("Idle", 500, 0, 0, 0)];
    const m = assembleDashboard("1", "T", rows, "x").months[0];
    expect(m.frequency).toBeCloseTo(15, 10);
    expect(m.avgTimePerDayMin).toBeCloseTo(6, 10);
  });

  it("maps rows to the dashboard shapes", () => {
    const rows = empty();
    rows.teamMonthly = [
      { tenant_id: 1, month: "2026-09", team: "Dubai", team_hierarchy: "Retail > Dubai", active_users: 10, logged_in_users: 9, training_users: 5, frequency: 4, avg_time_per_day_min: 12 },
      { tenant_id: 1, month: "2026-10", team: "Dubai", team_hierarchy: "Retail > Dubai", active_users: 12, logged_in_users: 10, training_users: 6, frequency: 5, avg_time_per_day_min: 14 },
    ];
    rows.topics = [{ topic_key: "T1", topic_name: "Safety", subject: "Compliance", category: "Policy", avg_baseline: 60, avg_current: 80, audience: 30, completion: 0.2, target_groups: 2, modules: 1, l1: 5, l2: 4, l3: 3, created_at: "2026-01-02" }];
    rows.frequency = [{ frequency_sort: 2, user_count: 30, avg_current: 82, avg_lift: 12 }, { frequency_sort: 1, user_count: 70, avg_current: 78, avg_lift: 8 }];
    rows.progress = [{ subject: "Compliance", question_level: 1, status: "graduate", records: 4 }, { subject: "Compliance", question_level: 1, status: "not started", records: 6 }, { subject: "x", question_level: 9, status: "graduate", records: 1 }];
    rows.usageMonthly = [{ month: "2026-10", logins: 100, training_activities: 80, training_seconds: 7200, completed_training: 20, games_played: 5, points_spent: 3, broadcasts_sent: 1 }];
    rows.hours = [{ hour: 3, activity_count: 9 }];
    rows.features = [{ feature: "Games", sort_order: 2, users: 5, active_users: 20 }, { feature: "Daily training", sort_order: 1, users: 10, active_users: 20 }];
    rows.matrix = [{ segment: "Experts", learners: 10, avg_knowledge: 0.95, avg_confidence: 0.9 }, { segment: "Mystery", learners: 1, avg_knowledge: 0.1, avg_confidence: 0.1 }];
    rows.deliveryGroups = [{ group_id: 7, name: "Front line", status: "Active", programs: 2, reinforcement_topics: 0 }];
    rows.deliverySummary = [{ avg_question_pool: 120, months_to_graduate: null }];
    rows.knowledgeAccount = [{ avg_baseline: 70, avg_current: 83, avg_confidence: 49, expert_users: 439, topic_completion: 0.14 }];

    const d = assembleDashboard("1", "Test", rows, "2026-10-22T00:00:00.000Z");

    expect(d.teams.map((t) => t.name)).toEqual(["Retail", "Dubai"]);
    expect(d.teamMonths.every((t) => t.teamId === "1:Retail>Dubai")).toBe(true);
    expect(d.months.map((m) => m.activeUsers)).toEqual([10, 12]);
    expect(d.topicStats[0]).toMatchObject({ baseline: 0.6, current: 0.8, l1: 5 });
    expect(d.frequency.map((f) => [f.bucket, Math.round(f.userShare * 100)])).toEqual([["< 10x / month", 70], ["10\u201320x / month", 30]]);
    expect(d.frequency[0].knowledgeLift).toBeCloseTo(0.08, 10);
    expect(d.progress).toHaveLength(1);
    expect(d.progress[0].counts).toMatchObject({ graduate: 4, notStarted: 6 });
    expect(d.usageMonthly[0].trainingHours).toBe(2);
    expect(d.hours).toHaveLength(24);
    expect(d.hours[3].count).toBe(9);
    expect(d.features.map((f) => [f.feature, f.share])).toEqual([["Daily training", 0.5], ["Games", 0.25]]);
    expect(d.matrix.map((m) => m.segment)).toEqual(["Experts"]);
    expect(d.groups[0]).toMatchObject({ id: "7", status: "Active", programs: 2 });
    expect(d.delivery).toEqual({ avgQuestionPool: 120, estimatedMonthsToGraduate: null });
    expect(d.knowledge).toMatchObject({ baseline: 0.7, current: 0.83, confidence: 0.49, experts: 439 });
  });

  it("copes with a tenant that returns nothing", () => {
    const d = assembleDashboard("9", "Empty", empty(), "2026-10-22T00:00:00.000Z");
    expect(d.months).toEqual([]);
    expect(d.knowledge.current).toBeNull();
    expect(d.hours).toHaveLength(24);
  });
});
