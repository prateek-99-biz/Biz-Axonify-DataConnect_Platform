/**
 * One picture of every client for the Insights pages (Account Health, Benchmarks, CSM Portfolio, Cost to Serve, Max AI
 * and the Client Leaderboard): health from the quarterly rows, feature and Max usage from the monthly rows, and the
 * commercial facts from the Salesforce file. Pure functions only, so every number on those pages is unit-tested.
 */
import type { ClientMonthRow, ClientPeriodRow, ClientSummary } from "@/server/data/ports";
import { aggregate, type DerivedMetrics, type RiskLevel } from "@/server/metrics/calculations";
import { daysCovered, previousPeriod, yearAgo, quartersIn, type Period } from "@/server/metrics/period";
import { FEATURES, growth, MIN_FEATURE_SHARE, monthsIn, monthYearAgo, sumMonths, usageComparison, type UsageMetrics } from "@/server/metrics/features";
import { buildPortfolio, type ClientRowView } from "./portfolio";

/** Clients with fewer active users than this in an average month are left out of rate rankings: 9 of 10 is not a win. */
export const MIN_RANKED_USERS = 25;

export interface ClientInsight {
  client: ClientSummary;
  /** Health, participation and knowledge for the period; null when the client has no quarterly data in it. */
  view: ClientRowView | null;
  health: DerivedMetrics | null;
  risk: RiskLevel;
  usage: UsageMetrics;
  usagePrev: UsageMetrics;
  usageYearAgo: UsageMetrics;
  /** Months of the period the monthly data covers. */
  monthsCovered: string[];
  /** This client's monthly rows by month (YYYY-MM). */
  monthly: Map<string, ClientMonthRow>;
  hasUsage: boolean;
  /** Same period one year earlier, from the quarterly rows. */
  healthYearAgo: DerivedMetrics;
  /** Average active users per month ÷ licences. */
  licenceUse: number | null;
  /**
   * Change in people logging in per month against the same months a year earlier. Null unless the client already had
   * MIN_RANKED_USERS logging in a month back then: a launch is not growth, and accounts created in bulk are not usage.
   */
  userGrowth: number | null;
  /** Change in participation against the same period a year earlier, in ratio points; null under the same rule. */
  participationGainYoY: number | null;
  maxGrowth: number | null;
  /**
   * Max questions against the previous period at the same pace (per day of data). A quarter in progress has fewer days
   * behind it, so its raw total always looks like a fall: 49 days of Q4 against 92 of Q3.
   */
  maxChange: number | null;
  /** Active users in the last month of the period that has data; null when the period has no monthly data. */
  activeAtEnd: number | null;
  /** Big enough for rate rankings, on average and still at the end of the period (a client that has gone quiet is not a leader). */
  ranked: boolean;
}

export interface InsightSet {
  clients: ClientInsight[];
  /** Every client in scope added together (ratio of sums). */
  total: { usage: UsageMetrics; usagePrev: UsageMetrics; usageYearAgo: UsageMetrics; maxChange: number | null };
  /** Days of data in the period ÷ days in the previous period: below 1 while the period is in progress. */
  pace: number | null;
  /** Quarterly portfolio view, as used by the Portfolio page. */
  portfolio: ReturnType<typeof buildPortfolio>;
  months: string[];
  previousMonths: string[];
  hasUsage: boolean;
}

export interface BuildOptions {
  /** When the data was refreshed, so a period in progress is compared at the same pace. */
  asOf?: string;
  /** Monthly rows counting all users, for licence use when `monthRows` follow the training-program count. */
  allUserRows?: ClientMonthRow[];
}

export function buildInsights(clients: ClientSummary[], periodRows: ClientPeriodRow[], monthRows: ClientMonthRow[], period: Period, inProgress = false, opts: BuildOptions = {}): InsightSet {
  const portfolio = buildPortfolio(clients, periodRows, { client: null, industry: null, period, inProgress });
  const viewById = new Map(portfolio.clients.map((v) => [v.client.id, v]));
  const months = monthsIn(period);
  const previousMonths = monthsIn(previousPeriod(period));
  const byClient = (rows: ClientMonthRow[]) => {
    const m = new Map<string, ClientMonthRow[]>();
    for (const r of rows) m.set(r.clientId, [...(m.get(r.clientId) ?? []), r]);
    return m;
  };
  const monthsByClient = byClient(monthRows);
  const allUsersByClient = opts.allUserRows ? byClient(opts.allUserRows) : monthsByClient;
  const ya = quartersIn(yearAgo(period));
  const monthSet = new Set(months);
  const dataMonths = new Set(monthRows.map((r) => r.month));
  const lastMonth = [...dataMonths].filter((m) => monthSet.has(m)).sort().at(-1) ?? null;
  const prevDays = daysCovered(previousMonths.filter((m) => dataMonths.has(m)), opts.asOf);
  const pace = prevDays > 0 ? daysCovered(months.filter((m) => dataMonths.has(m)), opts.asOf) / prevDays : null;
  const atPace = (now: number, before: number, beforeMonths: number) => (pace && beforeMonths > 0 ? growth(now, before * pace) : null);

  const list: ClientInsight[] = clients.map((client) => {
    const view = viewById.get(client.id) ?? null;
    const mine = monthsByClient.get(client.id) ?? [];
    const cmp = usageComparison(mine, months, previousMonths);
    const healthYearAgo = aggregate(periodRows.filter((r) => r.clientId === client.id), ya);
    const licences = client.commercial?.licenses ?? null;
    const avgActive = cmp.current.avgActiveUsers;
    // Licences are bought for everyone, so licence use counts all users whichever count the page shows.
    const avgActiveAll = usageComparison(allUsersByClient.get(client.id) ?? [], months, previousMonths).current.avgActiveUsers;
    const partNow = view?.current.participationRate ?? null;
    // A year earlier over the same months as now, so a quarter in progress is compared like for like (as growth is).
    const sameMonthsYearAgo = sumMonths(mine, cmp.yearAgo.months > 0 ? cmp.monthsCovered.map(monthYearAgo) : []);
    const partThen = sameMonthsYearAgo.activeUsers > 0 ? sameMonthsYearAgo.trainingUsers / sameMonthsYearAgo.activeUsers : healthYearAgo.participationRate;
    const perMonth = (n: number, m: number) => (m > 0 ? n / m : null);
    const loggedNow = perMonth(cmp.current.loggedInUsers, cmp.current.months);
    const loggedThen = perMonth(cmp.yearAgo.loggedInUsers, cmp.yearAgo.months);
    const liveYearAgo = (loggedThen ?? 0) >= MIN_RANKED_USERS;
    const activeAtEnd = lastMonth ? (mine.find((r) => r.month === lastMonth)?.activeUsers ?? 0) : null;
    return {
      client, view, health: view?.current ?? null, risk: view?.risk ?? "unknown",
      usage: cmp.current, usagePrev: cmp.previous, usageYearAgo: cmp.yearAgo, monthsCovered: cmp.monthsCovered, monthly: new Map(mine.map((r) => [r.month, r])),
      hasUsage: cmp.current.months > 0,
      healthYearAgo,
      licenceUse: licences && licences > 0 && avgActiveAll != null ? avgActiveAll / licences : null,
      userGrowth: liveYearAgo ? growth(loggedNow, loggedThen) : null,
      participationGainYoY: liveYearAgo && partNow != null && partThen != null ? partNow - partThen : null,
      maxGrowth: (() => { const ya = daysCovered(cmp.monthsCovered.map(monthYearAgo)); return ya > 0 ? growth(cmp.current.maxQueries, cmp.yearAgo.maxQueries * (daysCovered(cmp.monthsCovered, opts.asOf) / ya)) : null; })(),
      maxChange: atPace(cmp.current.maxQueries, cmp.previous.maxQueries, cmp.previous.months),
      activeAtEnd,
      ranked: (avgActive ?? 0) >= MIN_RANKED_USERS && (activeAtEnd == null || activeAtEnd >= MIN_RANKED_USERS),
    };
  });

  const all = monthRows.filter((r) => clients.some((c) => c.id === r.clientId));
  const tot = usageComparison(all, months, previousMonths);
  return {
    clients: list, portfolio, months, previousMonths, hasUsage: list.some((c) => c.hasUsage),
    total: { usage: tot.current, usagePrev: tot.previous, usageYearAgo: tot.yearAgo, maxChange: atPace(tot.current.maxQueries, tot.previous.maxQueries, tot.previous.months) },
    pace,
  };
}

export type RenewalRisk = "High" | "Medium" | "Low" | "Unknown";

/**
 * How worried to be about a renewal: a struggling account renewing within six months is High; a struggling account
 * further out, or a Moderate one renewing within three months, is Medium; everything else is Low.
 */
export function renewalRisk(risk: RiskLevel, daysToRenewal: number | null): RenewalRisk {
  if (risk === "unknown") return "Unknown";
  const struggling = risk === "critical" || risk === "at_risk";
  if (daysToRenewal == null || daysToRenewal < 0) return struggling ? "Medium" : "Low";
  if (struggling) return daysToRenewal <= 180 ? "High" : "Medium";
  return risk === "moderate" && daysToRenewal <= 90 ? "Medium" : "Low";
}

export type ValueStatus = "Good Value" | "Under-Used" | "At Risk" | "Unknown";

/**
 * Whether a contract is earning its keep: a struggling account is At Risk whatever its usage; under half the licences in
 * use is Under-Used; otherwise Good Value. Unknown without licences or health.
 */
export function valueStatus(licenceUse: number | null, risk: RiskLevel): ValueStatus {
  if (risk === "critical" || risk === "at_risk") return "At Risk";
  if (licenceUse == null) return "Unknown";
  return licenceUse < 0.5 ? "Under-Used" : risk === "unknown" ? "Unknown" : "Good Value";
}

export interface UsageDrop { clientId: string; name: string; csm: string; what: string; detail: string; severity: "critical" | "warning" }

/** A fall in engagement of this many points or more, against the previous period, is flagged; twice as much is critical. */
export const ENGAGEMENT_DROP = -0.1;
/** Max questions down by this share or more, from a base of at least MIN_MAX_BASE questions. */
export const MAX_DROP = -0.4;
export const MIN_MAX_BASE = 20;
export const REACH_DROP = -0.15;

/** Feature usage that fell sharply against the previous period: engagement, Max and broadcast reach. Worst first. */
export function usageDrops(insights: ClientInsight[]): UsageDrop[] {
  const out: UsageDrop[] = [];
  for (const c of insights) {
    if (!c.hasUsage || c.usagePrev.months === 0 || !c.ranked) continue;
    const base = { clientId: c.client.id, name: c.client.name, csm: c.client.csmName || "Unassigned" };
    const e = c.usage.engagement != null && c.usagePrev.engagement != null ? c.usage.engagement - c.usagePrev.engagement : null;
    if (e != null && e <= ENGAGEMENT_DROP) {
      out.push({ ...base, what: "Engagement", severity: e <= 2 * ENGAGEMENT_DROP ? "critical" : "warning", detail: `Logged-in share fell ${(Math.abs(e) * 100).toFixed(1)} pts to ${((c.usage.engagement ?? 0) * 100).toFixed(1)}%.` });
    }
    // At the same pace: a quarter in progress is compared per day of data, not as a part total against a whole one.
    const m = c.maxChange;
    if (c.usagePrev.maxQueries >= MIN_MAX_BASE && m != null && m <= MAX_DROP) {
      out.push({ ...base, what: "Max Questions", severity: m <= -0.75 ? "critical" : "warning", detail: `Down ${(Math.abs(m) * 100).toFixed(0)}% per day of data: ${c.usage.maxQueries.toLocaleString("en-US")} questions so far against ${c.usagePrev.maxQueries.toLocaleString("en-US")} in the whole previous period.` });
    }
    const r = c.usage.commsReach != null && c.usagePrev.commsReach != null && c.usagePrev.commsReachUsers > 0 ? c.usage.commsReach - c.usagePrev.commsReach : null;
    if (r != null && r <= REACH_DROP) {
      out.push({ ...base, what: "Broadcast Reach", severity: "warning", detail: `Share opening broadcasts fell ${(Math.abs(r) * 100).toFixed(1)} pts.` });
    }
  }
  return out.sort((a, b) => (a.severity === b.severity ? a.name.localeCompare(b.name) : a.severity === "critical" ? -1 : 1));
}

/** Averages a measure over a group of clients, each client counting once (a peer benchmark, not a user-weighted total). */
export function peerAverage(group: ClientInsight[], pick: (c: ClientInsight) => number | null): number | null {
  const vals = group.map(pick).filter((v): v is number => v != null && Number.isFinite(v));
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

export type LeaderFormat = "pct" | "pts" | "number" | "decimal" | "hours" | "score" | "growth" | "count";

export interface LeaderMetric {
  key: string;
  /** Card and column title. */
  label: string;
  /** The question it answers, in the words a CSM would use. */
  question: string;
  /** How it is worked out, in one sentence. */
  how: string;
  format: LeaderFormat;
  value: (c: ClientInsight) => number | null;
  /** Rates need a client of a real size; totals do not. */
  needsSize: boolean;
  group: "AI" | "Engagement" | "Learning" | "Growth" | "Features";
}

/** Everything the leaderboard can rank clients by. Higher is better for all of them. */
export const LEADER_METRICS: LeaderMetric[] = [
  { key: "maxPer100", label: "Most AI Use", group: "AI", format: "decimal", needsSize: true,
    question: "Who has used AI (Max) the most?", how: "Max questions per 100 active users in an average month, so large and small clients compare fairly.",
    value: (c) => (c.usage.maxQueries > 0 ? c.usage.maxPer100 : null) },
  { key: "maxAdoption", label: "Widest Max Adoption", group: "AI", format: "pct", needsSize: true,
    question: "Who has rolled Max out to the most people?", how: "Share of active users who asked Max at least one question in an average month.",
    value: (c) => (c.usage.maxUsers > 0 ? c.usage.maxAdoption : null) },
  { key: "maxQueries", label: "Most Max Questions", group: "AI", format: "count", needsSize: false,
    question: "Who has asked Max the most questions in total?", how: "All questions asked to Max in the period.",
    value: (c) => (c.usage.maxQueries > 0 ? c.usage.maxQueries : null) },
  { key: "participation", label: "Best Participation", group: "Engagement", format: "pct", needsSize: true,
    question: "Who has the best training participation?", how: "Active users who completed training ÷ active users, in an average month (Axonify's Average Training Participation; the Health Score input).",
    value: (c) => c.health?.participationRate ?? null },
  { key: "engagement", label: "Highest Engagement", group: "Engagement", format: "pct", needsSize: true,
    question: "Who has the highest engagement?", how: "Active users who logged in ÷ active users, in an average month (Axonify's Average Participation).",
    value: (c) => c.usage.engagement },
  { key: "commsReach", label: "Most Communications Use", group: "Engagement", format: "pct", needsSize: true,
    question: "Who uses communications (broadcasts) the most?", how: "Share of active users who opened a broadcast in an average month.",
    value: (c) => (c.usage.commsReachUsers > 0 ? c.usage.commsReach : null) },
  { key: "userGrowth", label: "Biggest Growth This Year", group: "Growth", format: "growth", needsSize: true,
    question: "Which client has grown the most this year?", how: `Change in people logging in per month against the same months a year earlier. Accounts that nobody uses do not count, and clients with fewer than ${MIN_RANKED_USERS} people logging in a year earlier are left out.`,
    value: (c) => c.userGrowth },
  { key: "participationGain", label: "Biggest Participation Gain", group: "Growth", format: "pts", needsSize: true,
    question: "Whose participation improved most over the year?", how: `Participation now minus participation in the same period a year earlier, in points. Clients that were not yet live a year earlier (fewer than ${MIN_RANKED_USERS} people logging in a month) are left out, so a launch does not count as improvement.`,
    value: (c) => c.participationGainYoY },
  { key: "knowledge", label: "Highest Knowledge", group: "Learning", format: "pct", needsSize: true,
    question: "Whose people know their material best?", how: "Average current knowledge score across every learner and topic.",
    value: (c) => c.health?.avgKnowledge ?? null },
  { key: "hoursPerUser", label: "Most Learning Time", group: "Learning", format: "hours", needsSize: true,
    question: "Whose people spend the most time learning?", how: "Hours in Axonify per active user in an average month.",
    value: (c) => (c.usage.learningSeconds > 0 ? c.usage.hoursPerUser : null) },
  // Needs a real size too: with three users, one person per feature is a third of the client.
  { key: "features", label: "Widest Feature Use", group: "Features", format: "number", needsSize: true,
    question: "Who uses the most Axonify features?", how: `How many of the ${FEATURES.length} tracked features at least ${MIN_FEATURE_SHARE * 100}% of active users used in an average month. One person trying a feature does not count.`,
    value: (c) => (c.hasUsage ? c.usage.featuresUsed : null) },
  { key: "health", label: "Healthiest Account", group: "Engagement", format: "score", needsSize: true,
    question: "Who is our healthiest account?", how: "Health Score: 50% participation plus 50% knowledge.",
    value: (c) => c.health?.healthScore ?? null },
];

export interface RankedEntry { insight: ClientInsight; value: number; rank: number }

/** Clients ranked on one measure, best first. Ties share a rank. Clients too small for a rate measure are left out. */
export function rankBy(insights: ClientInsight[], metric: LeaderMetric): RankedEntry[] {
  const vals = insights
    .filter((c) => !metric.needsSize || c.ranked)
    .map((c) => ({ insight: c, value: metric.value(c) }))
    .filter((x): x is { insight: ClientInsight; value: number } => x.value != null && Number.isFinite(x.value))
    .sort((a, b) => b.value - a.value || a.insight.client.name.localeCompare(b.insight.client.name));
  let rank = 0;
  return vals.map((v, i) => {
    if (i === 0 || v.value !== vals[i - 1].value) rank = i + 1;
    return { ...v, rank };
  });
}

/** How many leaderboard top-three places each client holds, most first: a simple "overall" view. */
export function podiumCounts(insights: ClientInsight[], metrics = LEADER_METRICS): { insight: ClientInsight; golds: number; podiums: number }[] {
  const tally = new Map<string, { insight: ClientInsight; golds: number; podiums: number }>();
  for (const m of metrics) {
    for (const e of rankBy(insights, m).filter((e) => e.rank <= 3)) {
      const t = tally.get(e.insight.client.id) ?? { insight: e.insight, golds: 0, podiums: 0 };
      t.podiums++;
      if (e.rank === 1) t.golds++;
      tally.set(e.insight.client.id, t);
    }
  }
  return [...tally.values()].sort((a, b) => b.golds - a.golds || b.podiums - a.podiums || a.insight.client.name.localeCompare(b.insight.client.name));
}

/** Healthy-or-moderate clients against at-risk-or-critical ones, averaged per client, for the "what is different" chart. */
export function healthyVsStruggling(insights: ClientInsight[]) {
  const healthy = insights.filter((c) => c.risk === "healthy" || c.risk === "moderate");
  const struggling = insights.filter((c) => c.risk === "at_risk" || c.risk === "critical");
  const measures: { key: string; label: string; pick: (c: ClientInsight) => number | null }[] = [
    { key: "participation", label: "Participation", pick: (c) => c.health?.participationRate ?? null },
    { key: "engagement", label: "Engagement", pick: (c) => c.usage.engagement },
    { key: "knowledge", label: "Knowledge", pick: (c) => c.health?.avgKnowledge ?? null },
    { key: "max", label: "Max Adoption", pick: (c) => (c.hasUsage ? c.usage.maxAdoption : null) },
    { key: "comms", label: "Broadcast Reach", pick: (c) => (c.hasUsage ? c.usage.commsReach : null) },
    { key: "features", label: "Features in Use", pick: (c) => c.usage.featureBreadth },
  ];
  return {
    healthyCount: healthy.length, strugglingCount: struggling.length,
    rows: measures.map((m) => ({ measure: m.label, healthy: peerAverage(healthy, m.pick), struggling: peerAverage(struggling, m.pick) })),
  };
}
