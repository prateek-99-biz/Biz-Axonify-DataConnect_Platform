import { describe, expect, it } from "vitest";
import type { ClientMonthRow, ClientPeriodRow, ClientSummary } from "@/server/data/ports";
import { FEATURES, featuresByQuarter, growth, monthsIn, monthYearAgo, quarterOfMonth, sumMonths, usageComparison, deriveUsage, MIN_MAX_RATINGS } from "@/server/metrics/features";
import { buildInsights, healthyVsStruggling, LEADER_METRICS, MIN_RANKED_USERS, peerAverage, podiumCounts, rankBy, renewalRisk, usageDrops, valueStatus } from "./insights";

const Q3 = { year: 2026, quarter: 3 as const };

const client = (id: string, over: Partial<ClientSummary> = {}): ClientSummary => ({ id, name: `Client ${id}`, industry: "Retail", csmEmail: "", csmName: "", axonifyTenantId: id, salesforceAccountId: null, ...over });

const month = (clientId: string, m: string, over: Partial<ClientMonthRow> = {}): ClientMonthRow => ({
  clientId, month: m, activeUsers: 100, loggedInUsers: 50, trainingUsers: 40, learningSeconds: 36000,
  maxQueries: 0, maxUsers: 0, maxGrounded: 0, maxRated: 0, maxNegative: 0, gameUsers: 0, gamesPlayed: 0, rewardUsers: 0,
  recognitionsSent: 0, recognitionUsers: 0, broadcastsSent: 0, commsReachUsers: 0, commsResponseUsers: 0, chatMessages: 0, chatUsers: 0,
  communityUsers: 0, discoverUsers: 0, tasksCompleted: 0, taskUsers: 0, formsSubmitted: 0, formUsers: 0, eventAttendees: 0, ...over,
});

const quarter = (clientId: string, period: string, participation: number, knowledge: number | null): ClientPeriodRow => ({
  clientId, period, registeredUsers: 100, activeUsers: 100, trainingUsers: Math.round(participation * 100), knowledgeLearners: knowledge == null ? 0 : 100,
  avgKnowledge: knowledge, retainedUsers: 90, previousActiveUsers: 100, sessions: 400, featuresAvailable: 0, featuresUsed: 0,
});

describe("months and periods", () => {
  it("lists the months of a quarter and of a year", () => {
    expect(monthsIn(Q3)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(monthsIn({ year: 2025, quarter: null })).toHaveLength(12);
    expect(monthYearAgo("2026-02")).toBe("2025-02");
    expect(quarterOfMonth("2026-09")).toBe("2026-Q3");
    expect(quarterOfMonth("2026-10")).toBe("2026-Q4");
  });
});

describe("usage metrics", () => {
  it("are ratios of sums, so they read as the average month", () => {
    const rows = [month("1", "2026-07", { activeUsers: 100, loggedInUsers: 80, maxUsers: 10, maxQueries: 30 }), month("1", "2026-08", { activeUsers: 300, loggedInUsers: 120, maxUsers: 30, maxQueries: 90 })];
    const u = deriveUsage(sumMonths(rows, monthsIn(Q3)));
    expect(u.months).toBe(2);
    expect(u.avgActiveUsers).toBe(200);
    expect(u.engagement).toBeCloseTo(200 / 400);
    expect(u.maxAdoption).toBeCloseTo(40 / 400);
    expect(u.maxPer100).toBeCloseTo(30);
    expect(u.maxPerUser).toBeCloseTo(3);
    expect(u.hoursPerUser).toBeCloseTo(20 / 400);
  });

  it("never invents a rate from nothing", () => {
    const u = deriveUsage(sumMonths([], monthsIn(Q3)));
    expect(u.engagement).toBeNull();
    expect(u.maxAdoption).toBeNull();
    expect(u.featureBreadth).toBeNull();
    expect(u.avgActiveUsers).toBeNull();
  });

  it("hides the helpful share until there are enough ratings", () => {
    const few = deriveUsage(sumMonths([month("1", "2026-07", { maxQueries: 20, maxRated: MIN_MAX_RATINGS - 1, maxNegative: 1 })], ["2026-07"]));
    const enough = deriveUsage(sumMonths([month("1", "2026-07", { maxQueries: 20, maxRated: 20, maxNegative: 5 })], ["2026-07"]));
    expect(few.maxHelpfulRate).toBeNull();
    expect(enough.maxHelpfulRate).toBeCloseTo(0.75);
  });

  it("counts the features anyone used", () => {
    const u = deriveUsage(sumMonths([month("1", "2026-07", { maxUsers: 1, chatUsers: 2 })], ["2026-07"]));
    // Training (40 users), Max and Chat.
    expect(u.featuresUsed).toBe(3);
    expect(u.featureBreadth).toBeCloseTo(3 / FEATURES.length);
    expect(u.featureShare.chat).toBeCloseTo(0.02);
  });

  it("compares a quarter in progress with the same months a year earlier", () => {
    const rows = [month("1", "2026-07", { activeUsers: 200 }), month("1", "2025-07", { activeUsers: 100 }), month("1", "2025-08", { activeUsers: 900 })];
    const cmp = usageComparison(rows, monthsIn(Q3), monthsIn({ year: 2026, quarter: 2 }));
    expect(cmp.monthsCovered).toEqual(["2026-07"]);
    expect(cmp.yearAgo.activeUsers).toBe(100);
    expect(growth(cmp.current.avgActiveUsers, cmp.yearAgo.avgActiveUsers)).toBeCloseTo(1);
  });

  it("gives each quarter its feature count", () => {
    const f = featuresByQuarter([month("1", "2026-07"), month("1", "2026-08", { gameUsers: 5 }), month("1", "2026-10")]);
    expect(f.get("1|2026-Q3")).toEqual({ used: 2, available: FEATURES.length });
    expect(f.get("1|2026-Q4")).toEqual({ used: 1, available: FEATURES.length });
  });

  it("has no growth without a base", () => {
    expect(growth(10, 0)).toBeNull();
    expect(growth(null, 5)).toBeNull();
    expect(growth(15, 10)).toBeCloseTo(0.5);
  });
});

describe("client insights and the leaderboard", () => {
  const clients = [client("a"), client("b"), client("small"), client("none", { commercial: { licenses: 200, licenseValue: 1000, currency: "USD", region: null, contractStart: null, renewalDate: null } })];
  const periods = [
    quarter("a", "2026-Q3", 0.8, 0.9), quarter("a", "2025-Q3", 0.6, 0.8),
    quarter("b", "2026-Q3", 0.4, 0.6), quarter("b", "2025-Q3", 0.5, 0.6),
    quarter("small", "2026-Q3", 0.95, 0.95),
    quarter("none", "2026-Q3", 0.5, 0.7),
  ];
  const months = [
    month("a", "2026-07", { activeUsers: 100, maxUsers: 50, maxQueries: 200, commsReachUsers: 90 }), month("a", "2025-07", { activeUsers: 80 }),
    month("b", "2026-07", { activeUsers: 400, maxUsers: 40, maxQueries: 400 }), month("b", "2025-07", { activeUsers: 400 }),
    month("small", "2026-07", { activeUsers: MIN_RANKED_USERS - 1, maxUsers: 20, maxQueries: 500 }),
    month("none", "2026-07", { activeUsers: 100 }),
  ];
  const set = buildInsights(clients, periods, months, Q3);
  const byId = (id: string) => set.clients.find((c) => c.client.id === id)!;

  it("joins health, usage, growth and licences per client", () => {
    expect(byId("a").health?.participationRate).toBeCloseTo(0.8);
    expect(byId("a").userGrowth).toBeCloseTo(0.25);
    expect(byId("a").participationGainYoY).toBeCloseTo(0.2);
    expect(byId("b").participationGainYoY).toBeCloseTo(-0.1);
    expect(byId("none").licenceUse).toBeCloseTo(0.5);
    expect(byId("small").ranked).toBe(false);
  });

  it("ranks fairly by size and leaves small clients out of rate measures", () => {
    const ai = LEADER_METRICS.find((m) => m.key === "maxPer100")!;
    const ranked = rankBy(set.clients, ai);
    expect(ranked.map((r) => r.insight.client.id)).toEqual(["a", "b"]);
    expect(ranked[0].value).toBeCloseTo(200);
    // A total does not need a minimum size, so the small client can win it.
    const total = rankBy(set.clients, LEADER_METRICS.find((m) => m.key === "maxQueries")!);
    expect(total[0].insight.client.id).toBe("small");
  });

  it("gives ties the same rank and skips clients without a value", () => {
    const ranked = rankBy(set.clients, LEADER_METRICS.find((m) => m.key === "knowledge")!);
    expect(ranked.map((r) => r.insight.client.id)).toEqual(["a", "none", "b"]);
    const comms = rankBy(set.clients, LEADER_METRICS.find((m) => m.key === "commsReach")!);
    expect(comms.map((r) => r.insight.client.id)).toEqual(["a"]);
  });

  it("rates renewal risk from health and the days left", () => {
    expect(renewalRisk("critical", 60)).toBe("High");
    expect(renewalRisk("at_risk", 400)).toBe("Medium");
    expect(renewalRisk("moderate", 30)).toBe("Medium");
    expect(renewalRisk("moderate", 200)).toBe("Low");
    expect(renewalRisk("healthy", 10)).toBe("Low");
    expect(renewalRisk("critical", null)).toBe("Medium");
    expect(renewalRisk("unknown", 10)).toBe("Unknown");
  });

  it("flags sharp falls in engagement, Max and broadcast reach", () => {
    const rows = [
      month("d", "2026-04", { activeUsers: 100, loggedInUsers: 80, maxQueries: 100, commsReachUsers: 60 }),
      month("d", "2026-07", { activeUsers: 100, loggedInUsers: 55, maxQueries: 10, commsReachUsers: 40 }),
      month("e", "2026-04", { activeUsers: 100, loggedInUsers: 50, maxQueries: 10 }),
      month("e", "2026-07", { activeUsers: 100, loggedInUsers: 48, maxQueries: 0 }),
    ];
    const s = buildInsights([client("d"), client("e")], [], rows, Q3);
    const drops = usageDrops(s.clients);
    expect(drops.map((d) => `${d.clientId}:${d.what}:${d.severity}`)).toEqual(["d:Engagement:critical", "d:Max Questions:critical", "d:Broadcast Reach:warning"]);
  });

  it("says whether a contract is good value", () => {
    expect(valueStatus(0.9, "healthy")).toBe("Good Value");
    expect(valueStatus(0.3, "healthy")).toBe("Under-Used");
    expect(valueStatus(0.9, "critical")).toBe("At Risk");
    expect(valueStatus(null, "at_risk")).toBe("At Risk");
    expect(valueStatus(null, "healthy")).toBe("Unknown");
  });

  it("counts podium places and compares healthy with struggling clients", () => {
    expect(podiumCounts(set.clients)[0].insight.client.id).toBe("a");
    const h = healthyVsStruggling(set.clients);
    expect(h.healthyCount + h.strugglingCount).toBeGreaterThan(0);
    expect(peerAverage(set.clients, (c) => c.health?.participationRate ?? null)).toBeCloseTo((0.8 + 0.4 + 0.95 + 0.5) / 4);
  });
});
