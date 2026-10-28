import type { ClientPeriodRow } from "@/server/data/ports";
import { HEALTH_WEIGHTS, RISK_THRESHOLDS } from "./definitions";

export type RiskLevel = "healthy" | "moderate" | "at_risk" | "critical" | "unknown";

/** Safe ratio: null when the denominator is zero/missing (never fabricate a 0%). */
export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

/** Knowledge arrives as 0-1 or 0-100; the report normalises the same way. */
export const normKnowledge = (v: number) => (v > 1 ? v / 100 : v);

export interface Totals {
  registeredUsers: number;
  activeUsers: number;
  trainingUsers: number;
  /** Learners with a knowledge score and the sum of their scores (weight and numerator of the average). */
  knowledgeLearners: number;
  knowledgeWeighted: number;
  retainedUsers: number;
  previousActiveUsers: number;
  sessions: number;
  featuresAvailable: number;
  featuresUsed: number;
}

const ZERO: Totals = {
  registeredUsers: 0, activeUsers: 0, trainingUsers: 0, knowledgeLearners: 0, knowledgeWeighted: 0,
  retainedUsers: 0, previousActiveUsers: 0, sessions: 0, featuresAvailable: 0, featuresUsed: 0,
};

export function sumRows(rows: ClientPeriodRow[]): Totals {
  return rows.reduce<Totals>((t, r) => {
    const hasKnowledge = r.avgKnowledge != null && r.knowledgeLearners > 0;
    return {
      registeredUsers: t.registeredUsers + r.registeredUsers,
      activeUsers: t.activeUsers + r.activeUsers,
      trainingUsers: t.trainingUsers + r.trainingUsers,
      knowledgeLearners: t.knowledgeLearners + (hasKnowledge ? r.knowledgeLearners : 0),
      knowledgeWeighted: t.knowledgeWeighted + (hasKnowledge ? normKnowledge(r.avgKnowledge!) * r.knowledgeLearners : 0),
      retainedUsers: t.retainedUsers + r.retainedUsers,
      previousActiveUsers: t.previousActiveUsers + r.previousActiveUsers,
      sessions: t.sessions + r.sessions,
      featuresAvailable: t.featuresAvailable + r.featuresAvailable,
      featuresUsed: t.featuresUsed + r.featuresUsed,
    };
  }, { ...ZERO });
}

export interface DerivedMetrics extends Totals {
  engagementRate: number | null;
  participationRate: number | null;
  avgKnowledge: number | null;
  retentionRate: number | null;
  featureAdoption: number | null;
  healthScore: number | null;
  risk: RiskLevel;
}

/** Report formula: 100 × (0.5·participation + 0.5·knowledge); null when either input is missing. */
export function healthScore(participation: number | null, knowledge: number | null): number | null {
  if (participation == null || knowledge == null) return null;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return 100 * (HEALTH_WEIGHTS.participation * clamp(participation) + HEALTH_WEIGHTS.knowledge * clamp(knowledge));
}

export function riskLevel(score: number | null): RiskLevel {
  if (score == null) return "unknown";
  if (score >= RISK_THRESHOLDS.healthy) return "healthy";
  if (score >= RISK_THRESHOLDS.moderate) return "moderate";
  if (score >= RISK_THRESHOLDS.atRisk) return "at_risk";
  return "critical";
}

/** Derived metrics from already-summed counts (ratio-of-sums, so portfolio rates are user-weighted). */
export function derive(t: Totals): DerivedMetrics {
  const engagementRate = ratio(t.activeUsers, t.registeredUsers);
  const participationRate = ratio(t.trainingUsers, t.activeUsers);
  const avgKnowledge = ratio(t.knowledgeWeighted, t.knowledgeLearners);
  const retentionRate = ratio(t.retainedUsers, t.previousActiveUsers);
  const featureAdoption = ratio(t.featuresUsed, t.featuresAvailable);
  const score = healthScore(participationRate, avgKnowledge);
  return { ...t, engagementRate, participationRate, avgKnowledge, retentionRate, featureAdoption, healthScore: score, risk: riskLevel(score) };
}

export interface Delta {
  abs: number | null;
  /** relative change vs prior; null when prior is 0/missing */
  pct: number | null;
}

export function delta(current: number | null, prior: number | null): Delta {
  if (current == null || prior == null) return { abs: null, pct: null };
  return { abs: current - prior, pct: prior === 0 ? null : (current - prior) / prior };
}

/** Which factor moved the health score most between two periods (weighted contribution). */
export function contributingFactor(cur: DerivedMetrics, prev: DerivedMetrics) {
  const parts = [
    { key: "participation", label: "Participation", d: diff(cur.participationRate, prev.participationRate) * HEALTH_WEIGHTS.participation },
    { key: "knowledge", label: "Knowledge", d: diff(cur.avgKnowledge, prev.avgKnowledge) * HEALTH_WEIGHTS.knowledge },
  ].map((p) => ({ ...p, points: p.d * 100 }));
  return parts.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
}

function diff(a: number | null, b: number | null) {
  return a == null || b == null ? 0 : a - b;
}

/** Aggregate rows for a set of quarter keys. */
export function aggregate(rows: ClientPeriodRow[], quarters: string[]): DerivedMetrics {
  const set = new Set(quarters);
  const inPeriod = rows.filter((r) => set.has(r.period));
  const t = sumRows(inPeriod);
  // Registered users are a point-in-time stock: use the latest quarter, not the sum across quarters.
  if (quarters.length > 1 && inPeriod.length) {
    const last = quarters[quarters.length - 1];
    const lastRows = inPeriod.filter((r) => r.period === last);
    t.registeredUsers = sumRows(lastRows).registeredUsers;
    // Knowledge is a current snapshot, like the report's Current Knowledge: use the latest quarter.
    const lastTotals = sumRows(lastRows);
    t.knowledgeLearners = lastTotals.knowledgeLearners;
    t.knowledgeWeighted = lastTotals.knowledgeWeighted;
    // Active users across a year is not the sum of quarterly actives (double counting); average of quarters
    // is a documented approximation until DataConnect supports distinct-over-year. Training users follow the same rule.
    t.activeUsers = Math.round(t.activeUsers / quarters.length);
    t.trainingUsers = Math.round(t.trainingUsers / quarters.length);
  }
  return derive(t);
}
