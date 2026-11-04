import { describe, expect, it } from "vitest";
import { aggregate, lowActivity, riskLevel, MIN_RETENTION_BASE } from "./calculations";
import { MIN_TREND_PROGRESS, periodProgress } from "./period";
import { RISK_THRESHOLDS } from "./definitions";
import { buildPortfolio } from "@/server/services/portfolio";
import { staleness } from "@/lib/staleness";
import { fmtHealth } from "@/lib/utils";
import type { ClientPeriodRow, ClientSummary } from "@/server/data/ports";

const row = (clientId: string, period: string, over: Partial<ClientPeriodRow> = {}): ClientPeriodRow => ({
  clientId, period, registeredUsers: 100, activeUsers: 90, trainingUsers: 45, knowledgeLearners: 90, avgKnowledge: 0.8, retainedUsers: 80, previousActiveUsers: 90,
  sessions: 200, featuresAvailable: 0, featuresUsed: 0, ...over,
});
const client = (id: string): ClientSummary => ({ id, name: `c${id}`, industry: "Retail", csmEmail: "", csmName: "", axonifyTenantId: id, salesforceAccountId: null });

describe("the displayed health number never contradicts its band", () => {
  it("reads 44 for 44.7, which is Critical, and 45 for exactly 45, which is At Risk", () => {
    expect(fmtHealth(44.7)).toBe("44");
    expect(riskLevel(44.7)).toBe("critical");
    expect(fmtHealth(45)).toBe("45");
    expect(riskLevel(45)).toBe("at_risk");
    expect(fmtHealth(null)).toBe("—");
  });

  it("agrees with the band for every score from 0 to 100 in steps of a tenth", () => {
    const bandOfDisplayed = (s: number) => riskLevel(Number(fmtHealth(s)));
    for (let tenths = 0; tenths <= 1000; tenths++) {
      const score = tenths / 10;
      expect(bandOfDisplayed(score), String(score)).toBe(riskLevel(score));
    }
    expect(RISK_THRESHOLDS.atRisk).toBe(45);
  });
});

describe("periodProgress", () => {
  it("counts how much of the quarter the data covers", () => {
    const p = periodProgress({ year: 2026, quarter: 4 }, "2026-11-02T06:45:00Z");
    expect(p).toMatchObject({ covered: 33, total: 92 });
    expect(p.fraction).toBeCloseTo(33 / 92, 5);
    expect(p.fraction).toBeLessThan(MIN_TREND_PROGRESS);
  });
  it("treats a finished quarter as whole, and a year in progress as a share of 365", () => {
    expect(periodProgress({ year: 2026, quarter: 3 }, "2026-11-02T06:45:00Z").fraction).toBe(1);
    expect(periodProgress({ year: 2026, quarter: null }, "2026-11-02T06:45:00Z")).toMatchObject({ covered: 306, total: 365 });
  });
  it("is never negative or above one", () => {
    expect(periodProgress({ year: 2027, quarter: 1 }, "2026-11-02T00:00:00Z").fraction).toBe(0);
    expect(periodProgress({ year: 2025, quarter: 1 }, "2026-11-02T00:00:00Z").fraction).toBe(1);
  });
});

describe("a partial quarter is not flagged as declining", () => {
  const Q4 = { year: 2026, quarter: 4 as const };
  const rows = [row("1", "2026-Q3", { trainingUsers: 60 }), row("1", "2026-Q4", { trainingUsers: 10 })];
  it("flags the drop when the quarter is mostly done, and not while it is early", () => {
    expect(buildPortfolio([client("1")], rows, { client: null, industry: null, period: Q4 }).clients[0].declining).toBe(true);
    expect(buildPortfolio([client("1")], rows, { client: null, industry: null, period: Q4, inProgress: true }).clients[0].declining).toBe(false);
  });
});

describe("accounts whose numbers cannot be trusted", () => {
  it("shows retention as unknown when the previous quarter had almost no active users", () => {
    const tiny = aggregate([row("1", "2026-Q4", { previousActiveUsers: 3, retainedUsers: 3 })], ["2026-Q4"]);
    expect(tiny.retentionRate).toBeNull();
    const fine = aggregate([row("1", "2026-Q4", { previousActiveUsers: MIN_RETENTION_BASE, retainedUsers: 9 })], ["2026-Q4"]);
    expect(fine.retentionRate).toBeCloseTo(0.9, 5);
  });
  it("flags a real-sized account with almost nobody active, but not a small one or a healthy one", () => {
    expect(lowActivity({ registeredUsers: 286, activeUsers: 3 })).toBe(true);
    expect(lowActivity({ registeredUsers: 20, activeUsers: 1 })).toBe(false);
    expect(lowActivity({ registeredUsers: 286, activeUsers: 240 })).toBe(false);
  });
});

describe("staleness", () => {
  const asOf = "2026-11-02T06:45:00Z";
  const at = (hours: number) => Date.parse(asOf) + hours * 3_600_000;
  it("is fresh within a day, stale after a day and very stale after three", () => {
    expect(staleness(asOf, at(3)).level).toBe("fresh");
    expect(staleness(asOf, at(25)).level).toBe("stale");
    expect(staleness(asOf, at(80)).level).toBe("very_stale");
  });
});
