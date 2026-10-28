/**
 * Pure checks used by `npm run reconcile`: compare dashboard figures with independently computed ones and test
 * invariants that must always hold. No I/O, so it is unit-tested; scripts/reconcile.ts supplies the BigQuery side.
 */
import type { DashboardData } from "./types";

export type CheckStatus = "pass" | "fail" | "skip";
export interface Check { tenant: string; name: string; status: CheckStatus; actual?: number | null; expected?: number | null; note?: string }
export interface Tolerance { abs?: number; rel?: number }

/** Passes when the gap is within the absolute tolerance or the relative one (share of the expected value). */
export function within(actual: number, expected: number, tol: Tolerance = {}): boolean {
  const gap = Math.abs(actual - expected);
  return gap <= (tol.abs ?? 0) || gap <= Math.abs(expected) * (tol.rel ?? 0);
}

export function compareValue(tenant: string, name: string, actual: number | null | undefined, expected: number | null | undefined, tol: Tolerance = {}): Check {
  if (actual == null || expected == null) {
    return { tenant, name, status: actual == null && expected == null ? "skip" : "fail", actual, expected, note: "one side has no value" };
  }
  return { tenant, name, status: within(actual, expected, tol) ? "pass" : "fail", actual, expected };
}

/**
 * Passes when the dashboard figure does not exceed the limit. Used for team-sourced user counts: they cover Axonify's
 * default population (users in active training programs), which is a subset of every user in the user-level view.
 */
export function compareAtMost(tenant: string, name: string, actual: number | null | undefined, limit: number | null | undefined, tol: Tolerance = {}): Check {
  if (actual == null || limit == null) return { tenant, name, status: actual == null && limit == null ? "skip" : "fail", actual, expected: limit, note: "one side has no value" };
  const ok = actual <= limit || within(actual, limit, tol);
  return { tenant, name, status: ok ? "pass" : "fail", actual, expected: limit, note: ok ? undefined : "more users than exist in the user-level view" };
}

const inUnit = (v: number | null | undefined) => v == null || (Number.isFinite(v) && v >= 0 && v <= 1);

/** Things that cannot be true of a correct dashboard, whatever the client. */
export function invariantChecks(tenant: string, d: DashboardData): Check[] {
  const out: Check[] = [];
  const check = (name: string, ok: boolean, note?: string) => out.push({ tenant, name: `invariant: ${name}`, status: ok ? "pass" : "fail", note: ok ? undefined : note });

  const latest = d.months.at(-1);
  if (latest) {
    check("training users <= logged-in users <= active users", latest.trainingUsers <= latest.loggedInUsers && latest.loggedInUsers <= latest.activeUsers,
      `${latest.trainingUsers} / ${latest.loggedInUsers} / ${latest.activeUsers}`);
    check("frequency is at most 31 days", d.months.every((m) => m.frequency <= 31), "a month has frequency above 31");
  }

  check("knowledge, confidence and completion are within 0-1", [d.knowledge.baseline, d.knowledge.current, d.knowledge.confidence, d.knowledge.topicCompletion].every(inUnit));
  check("topic scores and completion are within 0-1", d.topicStats.every((t) => inUnit(t.baseline) && inUnit(t.current) && inUnit(t.completion)));
  check("frequency-bucket knowledge is within 0-1", d.frequency.every((f) => inUnit(f.currentKnowledge) && inUnit(f.userShare)));
  check("matrix scores are within 0-1", d.matrix.every((m) => inUnit(m.avgKnowledge) && inUnit(m.avgConfidence)));
  check("current knowledge is not below baseline by more than 20 points", d.knowledge.current == null || d.knowledge.baseline == null || d.knowledge.current - d.knowledge.baseline > -0.2);

  const ids = new Set(d.teams.map((t) => t.id));
  check("team names do not contain a hierarchy separator", d.teams.every((t) => !t.name.includes("|")), "the team tree was not split on '|'");
  check("every team row points at a known team", d.teamMonths.every((m) => ids.has(m.teamId)));
  check("every team has a known parent", d.teams.every((t) => t.parentId == null || ids.has(t.parentId)));
  check("progress counts are not negative", d.progress.every((p) => Object.values(p.counts).every((n) => n >= 0)));
  check("usage totals are not negative", d.usageMonthly.every((u) => u.platformLogins >= 0 && u.trainingActivities >= 0 && u.trainingHours >= 0));
  return out;
}

export interface Reference { tenantId: number; capturedOn: string; source: string; values: Record<string, { value: number; abs?: number; rel?: number }> }

/** A reference captured from Axonify AdminZone is only comparable while the 30-day windows still overlap. */
export function referenceIsFresh(ref: Pick<Reference, "capturedOn">, today: Date, maxDays = 3): boolean {
  const days = (today.getTime() - new Date(`${ref.capturedOn}T00:00:00Z`).getTime()) / 86_400_000;
  return days >= 0 && days <= maxDays;
}

export function summarize(checks: Check[]) {
  const count = (s: CheckStatus) => checks.filter((c) => c.status === s).length;
  return { pass: count("pass"), fail: count("fail"), skip: count("skip"), ok: count("fail") === 0 };
}
