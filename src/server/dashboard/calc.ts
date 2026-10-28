/** Pure dashboard calculations. Formulas follow the Power BI report's DAX; thresholds are the report's. */
import type { DashboardData, MonthEngagement, ProgressCounts, ProgressStatus, TeamMonth, TeamNode, TopicStat } from "./types";
import { HEALTH_WEIGHTS } from "@/server/metrics/definitions";

export const PROGRESS_ORDER: ProgressStatus[] = ["notStarted", "beginner", "intermediate", "graduate", "expert"];
export const PROGRESS_LABEL: Record<ProgressStatus, string> = {
  notStarted: "Not started", beginner: "Beginner", intermediate: "Intermediate", graduate: "Graduate", expert: "Expert",
};

const div = (n: number, d: number) => (d > 0 ? n / d : null);

export function inRange(month: string, from: string, to: string) {
  return month >= from && month <= to;
}

export interface Range { from: string; to: string }

/** Shared date range: URL wins, otherwise the last 13 months of data (the report's default window). */
export function resolveRange(available: string[], from?: string, to?: string): Range {
  const ok = (m?: string) => !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && available.includes(m);
  const last = available.at(-1) ?? "";
  const dflt = available.at(Math.max(0, available.length - 13)) ?? last;
  let f = ok(from) ? from! : dflt;
  let t = ok(to) ? to! : last;
  if (f > t) [f, t] = [t, f];
  return { from: f, to: t };
}

export function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export const participation = (m: Pick<MonthEngagement, "trainingUsers" | "activeUsers">) => div(m.trainingUsers, m.activeUsers);

type TreeNode = { id: string; parentId: string | null };

/**
 * Rows the account roll-up should add together. The DataConnect team view is already a hierarchy roll-up (a parent
 * carries its children's members), so adding every row counts people several times. Keep a row only when none of
 * its ancestors is also present in the set; without a tree every row is kept.
 */
export function topRows(rows: TeamMonth[], teams?: TreeNode[]): TeamMonth[] {
  if (!teams?.length) return rows;
  const parent = new Map(teams.map((t) => [t.id, t.parentId]));
  const present = new Map<string, Set<string>>();
  for (const r of rows) present.set(r.month, (present.get(r.month) ?? new Set<string>()).add(r.teamId));
  return rows.filter((r) => {
    const ids = present.get(r.month)!;
    for (let p = parent.get(r.teamId); p; p = parent.get(p)) if (ids.has(p)) return false;
    return true;
  });
}

/** Roll team-month rows up to account-month rows; frequency and time are weighted by logged-in users. */
export function aggregateMonths(rows: TeamMonth[], teams?: TreeNode[]): MonthEngagement[] {
  const byMonth = new Map<string, TeamMonth[]>();
  for (const r of topRows(rows, teams)) byMonth.set(r.month, [...(byMonth.get(r.month) ?? []), r]);
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, rs]) => {
    const active = rs.reduce((s, x) => s + x.activeUsers, 0);
    // Team frequency and time are averages over the team's logged-in users, so that is the weight (Axonify's report does the same).
    const loggedIn = rs.reduce((s, x) => s + x.loggedInUsers, 0);
    const w = (f: (x: TeamMonth) => number) => (loggedIn ? rs.reduce((s, x) => s + f(x) * x.loggedInUsers, 0) / loggedIn : 0);
    return {
      month, activeUsers: active, loggedInUsers: rs.reduce((s, x) => s + x.loggedInUsers, 0), trainingUsers: rs.reduce((s, x) => s + x.trainingUsers, 0),
      frequency: w((x) => x.frequency), avgTimePerDayMin: w((x) => x.avgTimePerDayMin),
    };
  });
}

/** Report: Account Health Score = 0.5 participation + 0.5 knowledge. Returns a 0-1 ratio here. */
export function engagementHealth(part: number | null, knowledge: number | null): number | null {
  if (part == null || knowledge == null) return null;
  return HEALTH_WEIGHTS.participation * Math.min(1, part) + HEALTH_WEIGHTS.knowledge * Math.min(1, knowledge);
}

export type TeamStatus = "High" | "Medium" | "Low";

/** Report: participation score = p / 0.75 (cap 1), frequency score = f / 6 (cap 1), status on their average. */
export function teamStatus(part: number | null, freq: number | null): TeamStatus | null {
  if (part == null || freq == null) return null;
  const score = (Math.min(part / 0.75, 1) + Math.min(freq / 6, 1)) / 2;
  return score >= 0.85 ? "High" : score >= 0.6 ? "Medium" : "Low";
}

export type TeamTrend = "Rising" | "Declining" | "Stable" | "No prior data";

/** Report: Team Trend moves at +/- 3 participation points month over month. */
export function teamTrend(cur: number | null, prev: number | null): TeamTrend {
  if (cur == null || prev == null) return "No prior data";
  const d = cur - prev;
  return d >= 0.03 ? "Rising" : d <= -0.03 ? "Declining" : "Stable";
}

export interface TeamRow {
  team: TeamNode;
  activeUsers: number;
  participation: number | null;
  frequency: number | null;
  status: TeamStatus | null;
  trend: TeamTrend;
}

/** Leaf teams only; latest month in range is the snapshot, the month before it feeds the trend. */
export function teamRows(teams: TeamNode[], teamMonths: TeamMonth[], range: Range): TeamRow[] {
  const months = [...new Set(teamMonths.filter((t) => inRange(t.month, range.from, range.to)).map((t) => t.month))].sort();
  const cur = months.at(-1);
  const prev = months.at(-2);
  const byKey = new Map(teamMonths.map((t) => [`${t.teamId}|${t.month}`, t]));
  const leaves = teams.filter((n) => !teams.some((x) => x.parentId === n.id));
  return leaves.flatMap((team) => {
    const c = cur ? byKey.get(`${team.id}|${cur}`) : undefined;
    if (!c) return [];
    const p = prev ? byKey.get(`${team.id}|${prev}`) : undefined;
    const part = div(c.trainingUsers, c.activeUsers);
    return [{ team, activeUsers: c.activeUsers, participation: part, frequency: c.frequency, status: teamStatus(part, c.frequency), trend: teamTrend(part, p ? div(p.trainingUsers, p.activeUsers) : null) }];
  });
}

export function descendants(nodes: { id: string; parentId: string | null }[], ids: Set<string>) {
  const out = new Set(ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) if (n.parentId && out.has(n.parentId) && !out.has(n.id)) { out.add(n.id); grew = true; }
  }
  return out;
}

/** Report: Content Flag rules (first match wins). */
export function contentFlag(t: Pick<TopicStat, "l1" | "l2" | "l3" | "modules" | "targetGroups">): string {
  const q = t.l1 + t.l2 + t.l3;
  const peak = Math.max(t.l1, t.l2, t.l3);
  if (q === 0 && t.modules === 0) return "Warning: No released content";
  if (t.l1 > 12 && t.l2 === 0 && t.l3 === 0) return "Warning: L1-heavy with no L2/L3";
  if (q === 0 && t.modules > 0) return "Information: Training modules only";
  if (q > 0 && (t.l1 === 0 || t.l2 === 0 || t.l3 === 0)) return "Warning: Missing difficulty level";
  if (peak > 12) return "Information: Level exceeds 12 questions";
  if (t.targetGroups === 0) return "Information: No target group linked";
  return "No warning";
}

/** Report: Review Priority, 1 = most urgent, 7 = no issue. */
export function reviewPriority(t: Pick<TopicStat, "l1" | "l2" | "l3" | "modules" | "targetGroups">): number {
  const q = t.l1 + t.l2 + t.l3;
  const peak = Math.max(t.l1, t.l2, t.l3);
  if (q === 0 && t.modules === 0) return 1;
  if (t.l1 > 12 && t.l2 === 0 && t.l3 === 0) return 2;
  if (q > 0 && (t.l1 === 0 || t.l2 === 0 || t.l3 === 0)) return 3;
  if (peak > 12) return 4;
  if (q === 0 && t.modules > 0) return 5;
  if (t.targetGroups === 0) return 6;
  return 7;
}

/** Saturation = released questions against a 12-question target. Provisional: the report's formula was not visible. */
export const saturation = (t: Pick<TopicStat, "l1" | "l2" | "l3">) => (t.l1 + t.l2 + t.l3) / 12;

/** Audience-weighted average that skips topics where the value is missing. */
export function weightedAvg(stats: TopicStat[], f: (t: TopicStat) => number | null): number | null {
  let num = 0;
  let den = 0;
  for (const t of stats) {
    const v = f(t);
    if (v != null && t.audience > 0) { num += v * t.audience; den += t.audience; }
  }
  return den > 0 ? num / den : null;
}

export function sumProgress(list: { counts: ProgressCounts }[]): ProgressCounts {
  const z: ProgressCounts = { notStarted: 0, beginner: 0, intermediate: 0, graduate: 0, expert: 0 };
  for (const p of list) for (const k of PROGRESS_ORDER) z[k] += p.counts[k];
  return z;
}

export const totalOf = (c: ProgressCounts) => PROGRESS_ORDER.reduce((s, k) => s + c[k], 0);

/** Headline numbers for a range: user counts and rates come from the latest month in range. */
export function headline(data: DashboardData, range: Range) {
  const months = data.months.filter((m) => inRange(m.month, range.from, range.to)).sort((a, b) => a.month.localeCompare(b.month));
  const latest = months.at(-1) ?? null;
  const part = latest ? participation(latest) : null;
  return {
    months,
    latest,
    participation: part,
    avgKnowledge: data.knowledge.current,
    health: engagementHealth(part, data.knowledge.current),
  };
}
