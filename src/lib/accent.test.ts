import { describe, expect, it } from "vitest";
import { accentFor, accentForKpi } from "./accent";
import { KPI_DEFS, type KpiMetric } from "@/server/dashboard/definitions";

describe("accentFor", () => {
  it("keeps one colour per measure", () => {
    expect([accentFor("participation"), accentFor("knowledge"), accentFor("engagement"), accentFor("health")]).toEqual(["green", "purple", "orange", "green"]);
  });
  it("falls back to Axonify green", () => {
    expect(accentFor("retention")).toBe("green");
    expect(accentFor(undefined)).toBe("green");
  });
});

describe("accentForKpi", () => {
  it("colours learning measures purple, usage intensity orange, and people and participation green", () => {
    expect(accentForKpi("currentKnowledge")).toBe("purple");
    expect(accentForKpi("lift")).toBe("purple");
    expect(accentForKpi("frequency")).toBe("orange");
    expect(accentForKpi("participation")).toBe("green");
    expect(accentForKpi("activeUsers")).toBe("green");
    expect(accentForKpi(undefined)).toBe("green");
  });
  it("gives every dashboard KPI a defined accent", () => {
    for (const k of Object.keys(KPI_DEFS) as KpiMetric[]) expect(["green", "purple", "orange"], k).toContain(accentForKpi(k));
  });
});
