import { describe, expect, it } from "vitest";
import { aggregate, contributingFactor, delta, derive, healthScore, ratio, riskLevel, type Totals } from "./calculations";
import { compareQuarterKeys, parsePeriodKey, periodKey, previousPeriod, quarterOf, quarterRange, quartersIn, yearAgo } from "./period";
import type { ClientPeriodRow } from "@/server/data/ports";
import { can, parseRole } from "@/server/auth/rbac";
import { buildPortfolio } from "@/server/services/portfolio";

const row = (o: Partial<ClientPeriodRow>): ClientPeriodRow => ({
  clientId: "a", period: "2026-Q1", registeredUsers: 100, activeUsers: 50, trainingUsers: 40, knowledgeLearners: 40, avgKnowledge: 0.6,
  retainedUsers: 40, previousActiveUsers: 50, sessions: 500, featuresAvailable: 10, featuresUsed: 5, ...o,
});

const totals = (o: Partial<Totals>): Totals => ({
  registeredUsers: 0, activeUsers: 0, trainingUsers: 0, knowledgeLearners: 0, knowledgeWeighted: 0,
  retainedUsers: 0, previousActiveUsers: 0, sessions: 0, featuresAvailable: 0, featuresUsed: 0, ...o,
});

describe("ratio / delta", () => {
  it("returns null for zero denominators instead of 0", () => {
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(1, 4)).toBe(0.25);
  });
  it("computes absolute and relative change", () => {
    expect(delta(0.6, 0.5)).toEqual({ abs: expect.closeTo(0.1, 10), pct: expect.closeTo(0.2, 10) });
    expect(delta(5, 0)).toEqual({ abs: 5, pct: null });
    expect(delta(null, 1)).toEqual({ abs: null, pct: null });
  });
});

describe("derived metrics", () => {
  it("engagement, participation, knowledge, retention, adoption", () => {
    const m = derive(totals({ registeredUsers: 200, activeUsers: 100, trainingUsers: 80, knowledgeLearners: 50, knowledgeWeighted: 30, retainedUsers: 60, previousActiveUsers: 80, featuresAvailable: 10, featuresUsed: 4 }));
    expect(m.engagementRate).toBe(0.5);
    expect(m.participationRate).toBe(0.8);
    expect(m.avgKnowledge).toBeCloseTo(0.6, 10);
    expect(m.retentionRate).toBe(0.75);
    expect(m.featureAdoption).toBe(0.4);
    expect(m.healthScore).toBeCloseTo(100 * (0.5 * 0.8 + 0.5 * 0.6), 6);
  });
  it("normalises knowledge given as 0-100 and weights by learners", () => {
    const m = aggregate([row({ clientId: "a", knowledgeLearners: 10, avgKnowledge: 80 }), row({ clientId: "b", knowledgeLearners: 30, avgKnowledge: 0.4 })], ["2026-Q1"]);
    expect(m.avgKnowledge).toBeCloseTo((0.8 * 10 + 0.4 * 30) / 40, 10);
  });
  it("health is null (not 0) when any input is missing", () => {
    expect(healthScore(0.5, null)).toBeNull();
    expect(healthScore(null, 0.5)).toBeNull();
    expect(derive(totals({ activeUsers: 10, trainingUsers: 5 })).healthScore).toBeNull();
    expect(riskLevel(null)).toBe("unknown");
  });
  it("health bands follow the report", () => {
    expect(riskLevel(44.9)).toBe("critical");
    expect(riskLevel(45)).toBe("at_risk");
    expect(riskLevel(59.9)).toBe("at_risk");
    expect(riskLevel(60)).toBe("moderate");
    expect(riskLevel(74.9)).toBe("moderate");
    expect(riskLevel(75)).toBe("healthy");
  });
  it("identifies the biggest weighted factor", () => {
    const cur = derive(totals({ activeUsers: 100, trainingUsers: 40, knowledgeLearners: 40, knowledgeWeighted: 24 }));
    const prev = derive(totals({ activeUsers: 100, trainingUsers: 70, knowledgeLearners: 40, knowledgeWeighted: 24 }));
    expect(contributingFactor(cur, prev)[0].key).toBe("participation");
  });
});

describe("aggregate", () => {
  it("ratio-of-sums across clients (user weighted)", () => {
    const m = aggregate([row({ clientId: "a", registeredUsers: 100, activeUsers: 90 }), row({ clientId: "b", registeredUsers: 900, activeUsers: 90 })], ["2026-Q1"]);
    expect(m.engagementRate).toBeCloseTo(0.18, 6);
  });
  it("full year uses latest registered stock and averaged actives", () => {
    const rows = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"].map((p, i) => row({ period: p, registeredUsers: 100 + i * 10, activeUsers: 50 }));
    const m = aggregate(rows, quartersIn({ year: 2026, quarter: null }));
    expect(m.registeredUsers).toBe(130);
    expect(m.activeUsers).toBe(50);
  });
  it("ignores rows outside the period", () => {
    expect(aggregate([row({ period: "2025-Q4" })], ["2026-Q1"]).registeredUsers).toBe(0);
  });
});

describe("periods", () => {
  it("buckets dates into calendar quarters", () => {
    expect(quarterOf(new Date("2026-03-31T00:00:00Z"))).toEqual({ year: 2026, quarter: 1 });
    expect(quarterOf(new Date("2026-04-01T00:00:00Z"))).toEqual({ year: 2026, quarter: 2 });
    expect(quarterOf(new Date("2026-12-31T23:59:59Z"))).toEqual({ year: 2026, quarter: 4 });
  });
  it("previous and year-ago periods", () => {
    expect(previousPeriod({ year: 2026, quarter: 1 })).toEqual({ year: 2025, quarter: 4 });
    expect(previousPeriod({ year: 2026, quarter: null })).toEqual({ year: 2025, quarter: null });
    expect(yearAgo({ year: 2026, quarter: 3 })).toEqual({ year: 2025, quarter: 3 });
  });
  it("parses and formats keys", () => {
    expect(parsePeriodKey("2026-Q3")).toEqual({ year: 2026, quarter: 3 });
    expect(parsePeriodKey("2026")).toEqual({ year: 2026, quarter: null });
    expect(parsePeriodKey("2026-Q5")).toBeNull();
    expect(periodKey({ year: 2026, quarter: 2 })).toBe("2026-Q2");
  });
  it("quarter ranges cross year boundaries and sort lexicographically", () => {
    expect(quarterRange({ year: 2025, quarter: 3 }, { year: 2026, quarter: 2 })).toEqual(["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"]);
    expect(["2026-Q1", "2025-Q4"].sort(compareQuarterKeys)).toEqual(["2025-Q4", "2026-Q1"]);
  });
});

describe("portfolio view", () => {
  const clients = [
    { id: "a", name: "A", industry: "Retail", csmEmail: "x@y", csmName: "X", axonifyTenantId: "t1", salesforceAccountId: "s1" },
    { id: "b", name: "B", industry: "Logistics", csmEmail: "x@y", csmName: "X", axonifyTenantId: "t2", salesforceAccountId: null },
  ];
  const rows = [
    row({ clientId: "a", period: "2026-Q1" }), row({ clientId: "a", period: "2026-Q2", activeUsers: 20, trainingUsers: 8 }),
    row({ clientId: "b", period: "2026-Q1" }),
  ];
  it("filters by industry and reports clients without data separately", () => {
    const v = buildPortfolio(clients, rows, { client: null, industry: null, period: { year: 2026, quarter: 2 } });
    expect(v.clients.map((c) => c.client.id)).toEqual(["a"]);
    expect(v.noDataClients.map((c) => c.id)).toEqual(["b"]);
    expect(v.clients[0].declining).toBe(true);
    const r = buildPortfolio(clients, rows, { client: null, industry: "Logistics", period: { year: 2026, quarter: 1 } });
    expect(r.scopeClientCount).toBe(1);
  });
});

describe("rbac", () => {
  it("parses roles strictly", () => {
    expect(parseRole("admin")).toBe("ADMIN");
    expect(parseRole(" Member ")).toBe("MEMBER");
    expect(parseRole("CSM")).toBeNull();
    expect(parseRole(undefined)).toBeNull();
  });
  it("members can work but not manage or refresh", () => {
    expect(can("MEMBER", "clients:tasks:write")).toBe(true);
    expect(can("MEMBER", "reliability:read")).toBe(true);
    expect(can("MEMBER", "settings:manage")).toBe(false);
    expect(can("MEMBER", "sync:run")).toBe(false);
  });
  it("admins can do everything; unauthenticated can do nothing", () => {
    expect(can("ADMIN", "sync:run")).toBe(true);
    expect(can("ADMIN", "settings:manage")).toBe(true);
    expect(can(null, "portfolio:read")).toBe(false);
  });
});
