import { describe, expect, it } from "vitest";
import { mockDashboard } from "./mock";
import { joinDashboard, packRows, packTeamMonths, SECTION_NAMES, splitDashboard, unpackRows, unpackTeamMonths } from "./sections";

const d = mockDashboard("c1", "Client 1");

describe("splitDashboard / joinDashboard", () => {
  it("keeps the large arrays out of the core row", () => {
    const { core } = splitDashboard(d);
    for (const k of ["teams", "teamMonths", "topics", "topicStats", "groups", "progress"]) expect(k in core).toBe(false);
    expect(core.months).toEqual(d.months);
    expect(JSON.stringify(core).length).toBeLessThan(JSON.stringify(d).length);
  });

  it("round-trips when every section is requested", () => {
    const { core, parts } = splitDashboard(d);
    const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
    // Team rows are stored packed, which rounds frequency and time to 4 decimals.
    const expected = { ...d, teamMonths: d.teamMonths.map((t) => ({ ...t, frequency: r4(t.frequency), avgTimePerDayMin: r4(t.avgTimePerDayMin) })) };
    expect(joinDashboard(core, JSON.parse(JSON.stringify(parts)), SECTION_NAMES)).toEqual(expected);
  });

  it("leaves sections that were not requested empty", () => {
    const { core, parts } = splitDashboard(d);
    const j = joinDashboard(core, parts, ["groups"]);
    expect(j.groups).toEqual(d.groups);
    expect(j.teamMonths).toEqual([]);
    expect(j.topicStats).toEqual([]);
  });

  it("reads a snapshot written before the split, where the core still holds the arrays", () => {
    expect(joinDashboard(d as never, {}, ["teams"]).teamMonths).toEqual(d.teamMonths);
    expect(joinDashboard(d as never, {}, ["groups"]).teamMonths).toEqual([]);
  });
});

describe("packTeamMonths", () => {
  it("round-trips team-month rows", () => {
    const rows = d.teamMonths.map((r) => ({ ...r, frequency: Math.round(r.frequency * 1e4) / 1e4, avgTimePerDayMin: Math.round(r.avgTimePerDayMin * 1e4) / 1e4 }));
    expect(unpackTeamMonths(d.teams, packTeamMonths(d.teams, rows))).toEqual(rows);
  });

  it("is much smaller than the row objects", () => {
    expect(JSON.stringify(packTeamMonths(d.teams, d.teamMonths)).length).toBeLessThan(JSON.stringify(d.teamMonths).length / 2);
  });

  it("drops rows for unknown teams", () => {
    const rows = [{ ...d.teamMonths[0], teamId: "nope" }];
    expect(packTeamMonths(d.teams, rows).team).toEqual([]);
  });
});

describe("packRows", () => {
  it("round-trips topic and stat rows exactly", () => {
    for (const rows of [d.topics, d.topicStats, d.groups, d.teams] as object[][]) expect(unpackRows(packRows(rows))).toEqual(rows);
  });

  it("keeps nulls in text and number columns", () => {
    const rows = [{ a: "x", b: null, c: 1 }, { a: null, b: 2, c: null }, { a: "x", b: 3, c: 0 }];
    expect(unpackRows(packRows(rows))).toEqual(rows);
  });

  it("handles no rows", () => {
    expect(unpackRows(packRows([]))).toEqual([]);
  });

  it("stores repeated text once", () => {
    const p = packRows(Array.from({ length: 50 }, (_, i) => ({ id: "same-long-identifier", n: i })));
    expect(p.dict).toEqual(["same-long-identifier"]);
  });
});
