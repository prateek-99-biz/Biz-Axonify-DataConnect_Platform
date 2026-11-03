import { describe, expect, it } from "vitest";
import { buildAttention, buildClientHeadline, daysUntil } from "./attention";
import type { ClientRowView } from "./portfolio";
import type { RiskLevel } from "@/server/metrics/calculations";

const row = (id: string, risk: RiskLevel, health: number | null, over: { declining?: boolean; partPts?: number; factor?: { label: string; points: number } | null; renewal?: string | null } = {}): ClientRowView => ({
  client: { id, name: `client-${id}`, industry: "Unknown", csmEmail: "", csmName: "", axonifyTenantId: id, salesforceAccountId: null, commercial: over.renewal ? { licenses: null, licenseValue: null, currency: "USD", region: null, contractStart: null, renewalDate: over.renewal } : null },
  current: { healthScore: health } as ClientRowView["current"],
  previous: {} as ClientRowView["previous"],
  healthDelta: { abs: null, pct: null },
  participationDelta: { abs: over.partPts == null ? null : over.partPts / 100, pct: null },
  topFactor: over.factor === undefined ? null : over.factor,
  risk,
  declining: over.declining ?? false,
});

describe("buildAttention", () => {
  const today = "2026-11-02";

  it("counts Critical and At Risk as the headline, and lists them first, then declining ones, lowest health first", () => {
    const a = buildAttention([
      row("a", "healthy", 82), row("b", "moderate", 65, { declining: true, partPts: -5 }), row("c", "at_risk", 50), row("d", "critical", 44), row("e", "critical", 30),
    ], today, "Q3 2026");
    expect(a).toMatchObject({ total: 3, critical: 2, atRisk: 1, declining: 1 });
    expect(a.items.map((i) => i.clientId)).toEqual(["e", "d", "c", "b"]);
  });

  it("does not let a participation drop alone inflate the headline number", () => {
    const a = buildAttention([row("a", "healthy", 80, { declining: true, partPts: -4 }), row("b", "moderate", 62, { declining: true, partPts: -9 })], today, "Q3 2026");
    expect(a).toMatchObject({ total: 0, declining: 2 });
    expect(a.items).toHaveLength(2);
  });

  it("is empty when nothing needs attention", () => {
    expect(buildAttention([row("a", "healthy", 80), row("b", "moderate", 62)], today, "Q3 2026")).toMatchObject({ total: 0, declining: 0, items: [] });
  });

  it("limits the list but still counts everyone", () => {
    const many = Array.from({ length: 9 }, (_, i) => row(String(i), "critical", i));
    const a = buildAttention(many, today, "Q3 2026", 6);
    expect(a.total).toBe(9);
    expect(a.items).toHaveLength(6);
  });

  it("explains a declining client by the participation drop, and others by the factor that moved most", () => {
    const [x, y] = buildAttention([
      row("x", "at_risk", 50, { declining: true, partPts: -33.3, factor: { label: "Participation", points: -16.6 } }),
      row("y", "critical", 40, { factor: { label: "Knowledge", points: -2.4 } }),
    ], today, "Q3 2026").items.sort((p, q) => p.clientId.localeCompare(q.clientId));
    expect(x.change).toBe("Participation −33.3 pts vs Q3 2026");
    expect(y.change).toBe("Knowledge −2.4 health pts vs Q3 2026");
  });

  it("shows a renewal only when it is coming up within the window", () => {
    const items = buildAttention([
      row("soon", "critical", 40, { renewal: "2026-12-15" }), row("far", "critical", 41, { renewal: "2027-09-01" }), row("past", "critical", 42, { renewal: "2026-01-01" }),
    ], today, "Q3 2026").items;
    const by = Object.fromEntries(items.map((i) => [i.clientId, i.renewalDays]));
    expect(by).toEqual({ soon: 43, far: null, past: null });
  });
});

describe("buildClientHeadline", () => {
  const base = { prevLabel: "Q3 2026", factor: null, participationPts: null, declining: false, renewalDate: null, today: "2026-11-02" };

  it("names the band, the score and the move", () => {
    expect(buildClientHeadline({ ...base, risk: "critical", health: 42.4, healthDeltaPts: -8 }).headline).toBe("Critical: health is 42, down 8 pts from Q3 2026");
    expect(buildClientHeadline({ ...base, risk: "healthy", health: 80, healthDeltaPts: 2.6 }).headline).toBe("Healthy: health is 80, up 3 pts from Q3 2026");
    expect(buildClientHeadline({ ...base, risk: "moderate", health: 65, healthDeltaPts: 0.2 }).headline).toBe("Moderate: health is 65, unchanged from Q3 2026");
    expect(buildClientHeadline({ ...base, risk: "moderate", health: 65, healthDeltaPts: null }).headline).toBe("Moderate: health is 65");
  });

  it("uses a tone that matches the band", () => {
    const tone = (risk: RiskLevel) => buildClientHeadline({ ...base, risk, health: 50, healthDeltaPts: 0 }).tone;
    expect([tone("healthy"), tone("moderate"), tone("at_risk"), tone("critical")]).toEqual(["good", "neutral", "warn", "critical"]);
  });

  it("adds the participation drop, the biggest mover and the renewal", () => {
    const h = buildClientHeadline({ ...base, risk: "at_risk", health: 50, healthDeltaPts: -5, declining: true, participationPts: -12.34, factor: { label: "Participation", points: -6.2 }, renewalDate: "2026-12-15" });
    expect(h.points).toEqual(["Participation fell 12.3 pts against Q3 2026.", "Participation moved health most (−6.2 pts).", "Renews on 2026-12-15, in 43 days."]);
  });

  it("says so when there is no score, and when a renewal date has passed", () => {
    expect(buildClientHeadline({ ...base, risk: "unknown", health: null, healthDeltaPts: null }).headline).toMatch(/Not enough data/);
    expect(buildClientHeadline({ ...base, risk: "critical", health: 40, healthDeltaPts: null, renewalDate: "2026-01-01" }).points[0]).toMatch(/has passed/);
  });
});

describe("daysUntil", () => it("counts whole days", () => expect(daysUntil("2026-11-05", "2026-11-02")).toBe(3)));
