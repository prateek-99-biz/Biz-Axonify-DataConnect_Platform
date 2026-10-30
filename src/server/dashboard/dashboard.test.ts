import { describe, expect, it } from "vitest";
import { aggregateMonths, contentFlag, isCurrentMonth, monthAxisLabel, descendants, engagementHealth, withCoveredParents, resolveRange, reviewPriority, saturation, teamStatus, teamTrend } from "./calc";
import { mockDashboard } from "./mock";
import { can, parseRole } from "@/server/auth/rbac";

describe("report thresholds", () => {
  it("team status uses the report's capped participation and frequency scores", () => {
    expect(teamStatus(0.75, 6)).toBe("High");
    expect(teamStatus(0.75, 4)).toBe("Medium"); // (1 + 0.667) / 2 = 0.83
    expect(teamStatus(0.2, 1)).toBe("Low");
    expect(teamStatus(null, 3)).toBeNull();
  });
  it("team trend moves at 3 points", () => {
    expect(teamTrend(0.53, 0.5)).toBe("Rising");
    expect(teamTrend(0.47, 0.5)).toBe("Declining");
    expect(teamTrend(0.51, 0.5)).toBe("Stable");
    expect(teamTrend(0.5, null)).toBe("No prior data");
  });
  it("engagement health is half participation, half knowledge", () => {
    expect(engagementHealth(0.32, 0.85)).toBeCloseTo(0.585, 6);
    expect(engagementHealth(null, 0.85)).toBeNull();
  });
});

describe("content rules", () => {
  const t = (l1: number, l2: number, l3: number, modules = 0, targetGroups = 1) => ({ l1, l2, l3, modules, targetGroups });
  it("flags in the report's order", () => {
    expect(contentFlag(t(0, 0, 0))).toBe("Warning: No released content");
    expect(contentFlag(t(13, 0, 0))).toBe("Warning: L1-heavy with no L2/L3");
    expect(contentFlag(t(0, 0, 0, 2))).toBe("Information: Training modules only");
    expect(contentFlag(t(5, 5, 0))).toBe("Warning: Missing difficulty level");
    expect(contentFlag(t(13, 5, 5))).toBe("Information: Level exceeds 12 questions");
    expect(contentFlag(t(5, 5, 5, 0, 0))).toBe("Information: No target group linked");
    expect(contentFlag(t(5, 5, 5))).toBe("No warning");
  });
  it("priority mirrors the flags and saturation is questions over 12", () => {
    expect(reviewPriority(t(0, 0, 0))).toBe(1);
    expect(reviewPriority(t(5, 5, 5))).toBe(7);
    expect(saturation(t(5, 4, 4))).toBeCloseTo(13 / 12, 10);
  });
});

describe("in-progress month", () => {
  it("marks only the month of the last refresh", () => {
    expect(isCurrentMonth("2026-10", "2026-10-28T09:00:00.000Z")).toBe(true);
    expect(isCurrentMonth("2026-09", "2026-10-28T09:00:00.000Z")).toBe(false);
    expect(monthAxisLabel("2026-10", "2026-10-28T09:00:00.000Z")).toBe("Oct 2026 (to date)");
    expect(monthAxisLabel("2026-09", "2026-10-28T09:00:00.000Z")).toBe("Sep 2026");
  });
});

describe("ranges and trees", () => {
  const months = Array.from({ length: 20 }, (_, i) => `2025-${String((i % 12) + 1).padStart(2, "0")}`);
  it("defaults to the last 13 months and rejects unknown months", () => {
    const m = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"];
    expect(resolveRange(m)).toEqual({ from: "2025-03", to: "2026-03" });
    expect(resolveRange(m, "2099-01", "2026-02")).toEqual({ from: "2025-03", to: "2026-02" });
    expect(resolveRange(m, "2026-02", "2025-06")).toEqual({ from: "2025-06", to: "2026-02" });
    expect(months.length).toBe(20);
  });
  it("expands parents to all descendants", () => {
    const nodes = [{ id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" }, { id: "d", parentId: null }];
    expect([...descendants(nodes, new Set(["a"]))].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("mock dashboard data", () => {
  const d = mockDashboard("c_001", "Test Client");
  it("is deterministic and internally consistent", () => {
    expect(mockDashboard("c_001", "Test Client").months).toEqual(d.months);
    const rolled = aggregateMonths(d.teamMonths);
    expect(rolled.map((m) => m.activeUsers)).toEqual(d.months.map((m) => m.activeUsers));
  });
  it("keeps ratios within 0-1 and training users within active users", () => {
    for (const m of d.months) expect(m.trainingUsers).toBeLessThanOrEqual(m.activeUsers);
    for (const k of [d.knowledge.baseline, d.knowledge.current, d.knowledge.confidence, d.knowledge.topicCompletion]) {
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
    }
    expect(d.frequency.reduce((s, f) => s + f.userShare, 0)).toBeCloseTo(1, 1);
  });
});

describe("client role", () => {
  it("can read the dashboard but nothing internal", () => {
    expect(parseRole("client")).toBe("CLIENT");
    expect(can("CLIENT", "dashboard:read")).toBe(true);
    for (const p of ["dashboard:internal", "portfolio:read", "clients:read", "export:csv", "settings:manage", "sync:run"] as const) expect(can("CLIENT", p)).toBe(false);
    expect(can("MEMBER", "dashboard:internal")).toBe(true);
  });
});

describe("selecting a parent team", () => {
  const tree = [
    { id: "root", parentId: null }, { id: "a", parentId: "root" }, { id: "b", parentId: "root" },
    { id: "a1", parentId: "a" }, { id: "a2", parentId: "a" },
  ];
  it("adds a team once every leaf under it is selected, so people assigned straight to it are counted", () => {
    expect([...withCoveredParents(tree, new Set(["a1", "a2"]))].sort()).toEqual(["a", "a1", "a2"]);
  });
  it("adds nothing for a partial selection", () => {
    expect([...withCoveredParents(tree, new Set(["a1"]))]).toEqual(["a1"]);
  });
  it("adds every ancestor when all leaves are selected", () => {
    expect([...withCoveredParents(tree, new Set(["a1", "a2", "b"]))].sort()).toEqual(["a", "a1", "a2", "b", "root"]);
  });
});
