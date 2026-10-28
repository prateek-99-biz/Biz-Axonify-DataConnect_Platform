import { describe, expect, it } from "vitest";
import { compareAtMost, compareValue, invariantChecks, referenceIsFresh, summarize, within } from "./reconcile";
import { mockDashboard } from "./mock";
import type { DashboardData } from "./types";

const failed = (d: DashboardData) => invariantChecks("t", d).filter((c) => c.status === "fail").map((c) => c.name);
const fresh = () => structuredClone(mockDashboard("1", "Test"));

describe("comparison helpers", () => {
  it("accepts a gap within the absolute or the relative tolerance", () => {
    expect(within(100, 100)).toBe(true);
    expect(within(103, 100, { abs: 5 })).toBe(true);
    expect(within(110, 100, { abs: 5 })).toBe(false);
    expect(within(1010, 1000, { rel: 0.015 })).toBe(true);
    expect(within(1020, 1000, { rel: 0.015 })).toBe(false);
  });

  it("fails when only one side has a value and skips when neither does", () => {
    expect(compareValue("t", "x", 5, null).status).toBe("fail");
    expect(compareValue("t", "x", null, null).status).toBe("skip");
    expect(compareValue("t", "x", 2754, 8104, { rel: 0.015 }).status).toBe("fail");
    expect(compareValue("t", "x", 2754, 2774, { abs: 5, rel: 0.015 }).status).toBe("pass");
  });

  it("treats the user-level count as an upper bound", () => {
    expect(compareAtMost("t", "x", 700, 926).status).toBe("pass");
    expect(compareAtMost("t", "x", 926, 926).status).toBe("pass");
    expect(compareAtMost("t", "x", 8104, 2774).status).toBe("fail");
    expect(compareAtMost("t", "x", 3, null).status).toBe("fail");
  });

  it("only trusts an AdminZone reference for a few days", () => {
    const today = new Date("2026-10-30T12:00:00Z");
    expect(referenceIsFresh({ capturedOn: "2026-10-28" }, today)).toBe(true);
    expect(referenceIsFresh({ capturedOn: "2026-10-20" }, today)).toBe(false);
    expect(referenceIsFresh({ capturedOn: "2026-11-05" }, today)).toBe(false);
  });

  it("summarises pass, fail and skip counts", () => {
    const s = summarize([{ tenant: "t", name: "a", status: "pass" }, { tenant: "t", name: "b", status: "fail" }, { tenant: "t", name: "c", status: "skip" }]);
    expect(s).toEqual({ pass: 1, fail: 1, skip: 1, ok: false });
  });
});

describe("invariants", () => {
  it("hold for a consistent dashboard", () => {
    expect(failed(fresh())).toEqual([]);
  });

  it("catch the bugs found in the audit", () => {
    const rolledUp = fresh();
    const m = rolledUp.months.at(-1)!;
    m.activeUsers = m.loggedInUsers - 1; // users counted fewer times than logins
    expect(failed(rolledUp)).toContain("invariant: training users <= logged-in users <= active users");

    const doubleScaled = fresh();
    doubleScaled.knowledge.confidence = 49; // a 0-100 value that was never divided
    expect(failed(doubleScaled)).toContain("invariant: knowledge, confidence and completion are within 0-1");

    const flatTree = fresh();
    flatTree.teams[0].name = "Retail | AMERICAS | SAO PAULO"; // hierarchy not split
    expect(failed(flatTree)).toContain("invariant: team names do not contain a hierarchy separator");

    const orphan = fresh();
    orphan.teamMonths[0].teamId = "missing";
    expect(failed(orphan)).toContain("invariant: every team row points at a known team");
  });
});
