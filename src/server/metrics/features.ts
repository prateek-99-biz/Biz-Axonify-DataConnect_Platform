/**
 * Monthly feature and Max (AI assistant) metrics. Pure functions over ClientMonthRow, shared by the sync (feature
 * adoption on the quarterly rows), the Insights pages and the Client Leaderboard.
 *
 * Every share is a ratio of sums across the months in the period, so it reads as "the average month": the share of
 * active users who used the feature in a typical month, weighted by how many users were active in each month.
 */
import type { ClientMonthRow, ClientPeriodRow } from "@/server/data/ports";
import type { Period } from "./period";
import { ratio } from "./calculations";
import type { BasisGap, UserBasis } from "./basis";

export { parseUserBasis, type BasisGap, type UserBasis } from "./basis";

type CountKey = Exclude<keyof ClientMonthRow, "clientId" | "month" | "programActiveUsers" | "programLoggedInUsers" | "programTrainingUsers">;

/** True when a month has the training-program counts (a refresh after migration 0008). */
const hasProgramCounts = (r: ClientMonthRow) => (r.programActiveUsers ?? 0) > 0;

/**
 * Monthly rows on the chosen basis. For "programs", active, logged-in and training users are swapped for their
 * training-program counts, so every share that divides by active users (engagement, participation, Max adoption,
 * broadcast reach) follows. A month without program counts keeps its All Users counts.
 */
export function onBasis(rows: ClientMonthRow[], basis: UserBasis): ClientMonthRow[] {
  if (basis === "all") return rows;
  return rows.map((r) => (hasProgramCounts(r)
    ? { ...r, activeUsers: r.programActiveUsers!, loggedInUsers: r.programLoggedInUsers ?? 0, trainingUsers: r.programTrainingUsers ?? 0 }
    : r));
}

/** Below this share of a client's active users in training programs, its two views tell different stories and it is flagged. */
export const PROGRAM_GAP_SHARE = 0.75;
/** ...and only when at least this many people are outside the programs. */
export const PROGRAM_GAP_MIN_PEOPLE = 100;

/**
 * Clients whose All Users and training-program counts differ enough to change how they read, in the latest month of
 * `months` that has both counts: many accounts not yet in a training program (a rollout under way, archived teams).
 * Largest gap first.
 */
export function basisGaps(rows: ClientMonthRow[], months: string[]): BasisGap[] {
  const set = new Set(months);
  const latest = new Map<string, ClientMonthRow>();
  for (const r of rows) {
    if (!set.has(r.month) || !hasProgramCounts(r)) continue;
    const cur = latest.get(r.clientId);
    if (!cur || r.month > cur.month) latest.set(r.clientId, r);
  }
  return [...latest.values()]
    .map((r) => ({
      clientId: r.clientId, month: r.month, allActive: r.activeUsers, programActive: r.programActiveUsers!,
      outside: Math.max(0, r.activeUsers - r.programActiveUsers!),
      allEngagement: ratio(r.loggedInUsers, r.activeUsers), programEngagement: ratio(r.programLoggedInUsers ?? 0, r.programActiveUsers!),
    }))
    .filter((g) => g.outside >= PROGRAM_GAP_MIN_PEOPLE && g.programActive < PROGRAM_GAP_SHARE * g.allActive)
    .sort((a, b) => b.outside - a.outside);
}

/**
 * A feature counts as in use when at least this share of active users used it in an average month. One person trying
 * it once (an admin testing chat) is not adoption, and it made Widest Feature Use and Feature Adoption read high.
 */
export const MIN_FEATURE_SHARE = 0.01;

export interface FeatureDef {
  key: string;
  label: string;
  /** The month column that counts the people who used it. */
  users: CountKey;
  /** One plain sentence: what counts as using it. */
  means: string;
  group: "Learning" | "AI" | "Communication" | "Motivation" | "Operations";
}

/** The Axonify features the platform can see in DataConnect, in the order they are shown. */
export const FEATURES: FeatureDef[] = [
  { key: "training", label: "Daily Training", users: "trainingUsers", group: "Learning", means: "Completed at least one training session" },
  { key: "max", label: "Max AI Assistant", users: "maxUsers", group: "AI", means: "Asked Max at least one question" },
  { key: "broadcasts", label: "Broadcasts", users: "commsReachUsers", group: "Communication", means: "Opened at least one broadcast message" },
  { key: "chat", label: "Chat", users: "chatUsers", group: "Communication", means: "Sent at least one chat message" },
  { key: "communities", label: "Communities", users: "communityUsers", group: "Communication", means: "Viewed at least one community post" },
  { key: "discover", label: "Knowledge Base", users: "discoverUsers", group: "Learning", means: "Viewed at least one Discover page" },
  { key: "games", label: "Games", users: "gameUsers", group: "Motivation", means: "Played at least one game" },
  { key: "rewards", label: "Rewards", users: "rewardUsers", group: "Motivation", means: "Spent points on a prize, raffle or auction" },
  { key: "recognition", label: "Recognition", users: "recognitionUsers", group: "Motivation", means: "Sent at least one recognition pin" },
  { key: "tasks", label: "Tasks", users: "taskUsers", group: "Operations", means: "Completed at least one task" },
  { key: "forms", label: "Forms and Checkpoints", users: "formUsers", group: "Operations", means: "Submitted at least one form or checkpoint" },
  { key: "events", label: "Events", users: "eventAttendees", group: "Learning", means: "Attended at least one event" },
];

const COUNT_KEYS: CountKey[] = [
  "activeUsers", "loggedInUsers", "trainingUsers", "learningSeconds", "maxQueries", "maxUsers", "maxGrounded", "maxRated", "maxNegative",
  "gameUsers", "gamesPlayed", "rewardUsers", "recognitionsSent", "recognitionUsers", "broadcastsSent", "commsReachUsers", "commsResponseUsers",
  "chatMessages", "chatUsers", "communityUsers", "discoverUsers", "tasksCompleted", "taskUsers", "formsSubmitted", "formUsers", "eventAttendees",
];

export type MonthTotals = Record<CountKey, number> & { months: number };

/** Below this many Max ratings, the helpful share is not shown: 2 of 3 is not "67% helpful". */
export const MIN_MAX_RATINGS = 10;

/** Calendar months covered by a quarter or a year, as YYYY-MM. */
export function monthsIn(p: Period): string[] {
  const first = p.quarter ? (p.quarter - 1) * 3 : 0;
  const n = p.quarter ? 3 : 12;
  return Array.from({ length: n }, (_, i) => `${p.year}-${String(first + i + 1).padStart(2, "0")}`);
}

/** The same month one year earlier. */
export const monthYearAgo = (m: string) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`;

/** Quarter key (2026-Q3) of a month (2026-08). */
export const quarterOfMonth = (m: string) => `${m.slice(0, 4)}-Q${Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1}`;

/**
 * Adds each quarter's monthly active and training users to its period row, so participation can be the monthly share
 * (see ClientPeriodRow.monthActiveSum). Quarters without monthly rows are returned unchanged.
 */
export function withMonthlyParticipation(rows: ClientPeriodRow[], months: ClientMonthRow[]): ClientPeriodRow[] {
  const sums = new Map<string, { active: number; training: number }>();
  for (const m of months) {
    const k = `${m.clientId}|${quarterOfMonth(m.month)}`;
    const s = sums.get(k) ?? { active: 0, training: 0 };
    s.active += m.activeUsers;
    s.training += m.trainingUsers;
    sums.set(k, s);
  }
  return rows.map((r) => {
    const s = sums.get(`${r.clientId}|${r.period}`);
    return s && s.active > 0 ? { ...r, monthActiveSum: s.active, monthTrainingSum: s.training } : r;
  });
}

export function sumMonths(rows: ClientMonthRow[], months: Iterable<string>): MonthTotals {
  const set = new Set(months);
  const t = Object.fromEntries(COUNT_KEYS.map((k) => [k, 0])) as MonthTotals;
  const seen = new Set<string>();
  for (const r of rows) {
    if (!set.has(r.month)) continue;
    seen.add(r.month);
    for (const k of COUNT_KEYS) t[k] += r[k] ?? 0;
  }
  t.months = seen.size;
  return t;
}

export interface UsageMetrics extends MonthTotals {
  /** Average active users per month. */
  avgActiveUsers: number | null;
  /** Logged-in ÷ active: Axonify's "Average Participation". Called Engagement on these pages. */
  engagement: number | null;
  /** Training ÷ active, by month. */
  trainingShare: number | null;
  learningHours: number;
  /** Learning hours per active user per month. */
  hoursPerUser: number | null;
  /** Share of active users who asked Max a question in an average month. */
  maxAdoption: number | null;
  /** Max questions per 100 active users per month: AI use that is fair between large and small clients. */
  maxPer100: number | null;
  /** Questions per person who used Max. */
  maxPerUser: number | null;
  /** Share of Max answers that cited the client's own content. */
  maxGroundedRate: number | null;
  /** Share of rated Max answers not rated negatively; null under MIN_MAX_RATINGS ratings. */
  maxHelpfulRate: number | null;
  /** Share of active users who opened a broadcast. */
  commsReach: number | null;
  /** Share of active users who answered a broadcast question or survey. */
  commsResponse: number | null;
  /** Share of active users who used each feature, by feature key. */
  featureShare: Record<string, number | null>;
  /** How many of FEATURES at least MIN_FEATURE_SHARE of active users used in an average month. */
  featuresUsed: number;
  featureBreadth: number | null;
}

export function deriveUsage(t: MonthTotals): UsageMetrics {
  const a = t.activeUsers;
  const featureShare = Object.fromEntries(FEATURES.map((f) => [f.key, ratio(t[f.users], a)]));
  const featuresUsed = FEATURES.filter((f) => t[f.users] > 0 && t[f.users] >= MIN_FEATURE_SHARE * a).length;
  const learningHours = t.learningSeconds / 3600;
  return {
    ...t,
    avgActiveUsers: t.months > 0 ? a / t.months : null,
    engagement: ratio(t.loggedInUsers, a),
    trainingShare: ratio(t.trainingUsers, a),
    learningHours,
    hoursPerUser: ratio(learningHours, a),
    maxAdoption: ratio(t.maxUsers, a),
    maxPer100: a > 0 ? (100 * t.maxQueries) / a : null,
    maxPerUser: ratio(t.maxQueries, t.maxUsers),
    maxGroundedRate: ratio(t.maxGrounded, t.maxQueries),
    maxHelpfulRate: t.maxRated >= MIN_MAX_RATINGS ? 1 - t.maxNegative / t.maxRated : null,
    commsReach: ratio(t.commsReachUsers, a),
    commsResponse: ratio(t.commsResponseUsers, a),
    featureShare,
    featuresUsed,
    featureBreadth: t.months > 0 ? featuresUsed / FEATURES.length : null,
  };
}

export const usageFor = (rows: ClientMonthRow[], months: Iterable<string>) => deriveUsage(sumMonths(rows, months));

/**
 * Current period, the period before it and the same months a year earlier. The year-ago comparison uses only the months
 * the current period has data for, so a quarter in progress is compared like for like.
 */
export function usageComparison(rows: ClientMonthRow[], months: string[], previousMonths: string[]) {
  const have = new Set(rows.map((r) => r.month));
  const current = months.filter((m) => have.has(m));
  return {
    current: usageFor(rows, current),
    previous: usageFor(rows, previousMonths),
    yearAgo: usageFor(rows, current.map(monthYearAgo)),
    monthsCovered: current,
  };
}

/** Features used in each quarter, for the quarterly rows' Features Used / Available. */
export function featuresByQuarter(rows: ClientMonthRow[]): Map<string, { used: number; available: number }> {
  const byKey = new Map<string, ClientMonthRow[]>();
  for (const r of rows) {
    const k = `${r.clientId}|${quarterOfMonth(r.month)}`;
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  const out = new Map<string, { used: number; available: number }>();
  for (const [k, rs] of byKey) out.set(k, { used: usageFor(rs, rs.map((r) => r.month)).featuresUsed, available: FEATURES.length });
  return out;
}

/** Relative change; null when there is nothing to compare against. */
export function growth(current: number | null, before: number | null): number | null {
  if (current == null || before == null || before <= 0) return null;
  return (current - before) / before;
}
