import { describe, expect, it } from "vitest";
import { carryKnowledge, firstKnowledgePeriod } from "./knowledge-history";

const row = (clientId: string, period: string, avgKnowledge: number | null, knowledgeLearners = avgKnowledge == null ? 0 : 10) => ({ clientId, period, avgKnowledge, knowledgeLearners, sessions: 1 });

describe("carryKnowledge", () => {
  it("keeps the last captured knowledge for a quarter once it is no longer the latest", () => {
    // Next quarter's first sync: Q4 now has no knowledge from BigQuery, Q1 does.
    const fresh = [row("a", "2026-Q4", null), row("a", "2027-Q1", 0.8)];
    const saved = [row("a", "2026-Q4", 0.71, 120)];
    const { rows, carried } = carryKnowledge(fresh, saved);
    expect(rows[0]).toMatchObject({ period: "2026-Q4", avgKnowledge: 0.71, knowledgeLearners: 120 });
    expect(rows[1]).toMatchObject({ period: "2027-Q1", avgKnowledge: 0.8 });
    expect(carried).toBe(1);
  });

  it("lets a fresh value replace the saved one for the latest quarter", () => {
    const { rows, carried } = carryKnowledge([row("a", "2026-Q4", 0.9, 200)], [row("a", "2026-Q4", 0.71, 120)]);
    expect(rows[0]).toMatchObject({ avgKnowledge: 0.9, knowledgeLearners: 200 });
    expect(carried).toBe(0);
  });

  it("matches on client and period, never across clients", () => {
    const { rows } = carryKnowledge([row("b", "2026-Q4", null)], [row("a", "2026-Q4", 0.71, 120)]);
    expect(rows[0].avgKnowledge).toBeNull();
  });

  it("ignores saved rows without knowledge and does not bring back periods that are gone", () => {
    const { rows, carried } = carryKnowledge([row("a", "2026-Q4", null)], [row("a", "2026-Q4", null), row("a", "2024-Q1", 0.5, 50)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].avgKnowledge).toBeNull();
    expect(carried).toBe(0);
  });

  it("does not change the rows it is given", () => {
    const fresh = [row("a", "2026-Q4", null)];
    carryKnowledge(fresh, [row("a", "2026-Q4", 0.71, 120)]);
    expect(fresh[0].avgKnowledge).toBeNull();
  });

  it("works with no saved data", () => {
    expect(carryKnowledge([row("a", "2026-Q4", null)], []).carried).toBe(0);
  });
});

describe("firstKnowledgePeriod", () => {
  it("finds the earliest period with knowledge", () => {
    expect(firstKnowledgePeriod([row("a", "2027-Q1", 0.8), row("a", "2026-Q4", 0.7), row("a", "2026-Q3", null)])).toBe("2026-Q4");
  });
  it("is null when there is none", () => {
    expect(firstKnowledgePeriod([row("a", "2026-Q3", null)])).toBeNull();
  });
});
