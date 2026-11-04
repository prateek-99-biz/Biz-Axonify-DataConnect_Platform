import { describe, expect, it } from "vitest";
import {
  buildAccountCards, buildRenewals, buildWatchlist, bookSummary, csmKeyForEmail, declineStreak, homePathFor, renewalValueByCurrency, watchAction, weekAgenda, NO_SIGNAL,
  type AccountCard, type AccountSignal,
} from "./accounts";
import { buildPortfolio } from "./portfolio";
import type { ClientPeriodRow, ClientSummary } from "@/server/data/ports";

const TODAY = "2026-11-02";
const Q4 = { year: 2026, quarter: 4 as const };

const client = (id: string, over: Partial<ClientSummary> = {}): ClientSummary => ({ id, name: `c${id}`, industry: "Retail", csmEmail: "sarah@bizgroup.ae", csmName: "Sarah K.", axonifyTenantId: id, salesforceAccountId: null, ...over });
const withRenewal = (date: string, value = 1000, currency = "USD") => ({ commercial: { licenses: 100, licenseValue: value, currency, region: null, contractStart: null, renewalDate: date } });

const row = (clientId: string, period: string, participation: number, knowledge: number | null): ClientPeriodRow => ({
  clientId, period, registeredUsers: 100, activeUsers: 100, trainingUsers: Math.round(participation * 100), knowledgeLearners: knowledge == null ? 0 : 100, avgKnowledge: knowledge,
  retainedUsers: 100, previousActiveUsers: 100, sessions: 500, featuresAvailable: 0, featuresUsed: 0,
});

const card = (over: Partial<AccountCard> = {}): AccountCard => ({
  clientId: "1", name: "A", risk: "healthy", health: 80, healthDeltaPts: 0, participation: 0.8, participationDeltaPts: 0, declining: false, knowledge: 0.8, users: 100, spark: [],
  renewalDate: null, renewalDays: null, openTasks: 0, overdueTasks: 0, nextTaskDue: null, daysSinceNote: 5, noData: false, dataCheck: false, ...over,
});

describe("who a signed-in person is", () => {
  const clients = [client("1"), client("2", { csmEmail: "omar@bizgroup.ae", csmName: "Omar" }), client("3", { csmEmail: "", csmName: "" })];
  it("matches on CSM email, ignoring case and spaces", () => {
    expect(csmKeyForEmail("  Sarah@BizGroup.ae ", clients)).toBe("sarah@bizgroup.ae");
    expect(csmKeyForEmail("nobody@bizgroup.ae", clients)).toBeNull();
  });
  it("lands CSMs on their own accounts and everyone else on the portfolio", () => {
    expect(homePathFor("omar@bizgroup.ae", clients)).toBe("/csm");
    expect(homePathFor("lead@bizgroup.ae", clients)).toBe("/portfolio");
  });
});

describe("buildAccountCards", () => {
  const clients = [client("1"), client("2"), client("3"), client("4")];
  const rows = [
    row("1", "2026-Q3", 0.8, 0.9), row("1", "2026-Q4", 0.8, 0.9),   // healthy
    row("2", "2026-Q3", 0.5, 0.9), row("2", "2026-Q4", 0.1, 0.4),   // critical, falling
    row("3", "2026-Q3", 0.7, 0.8), row("3", "2026-Q4", 0.6, 0.8),   // moderate, falling 10 pts
  ];
  const cards = buildAccountCards(clients, rows, Q4, new Map<string, AccountSignal>(), TODAY);

  it("puts the most urgent first and accounts without data last", () => {
    expect(cards.map((c) => c.clientId)).toEqual(["2", "3", "1", "4"]);
    expect(cards[3]).toMatchObject({ noData: true, risk: "unknown", health: null });
  });
  it("carries the trend, change and users", () => {
    const c2 = cards.find((c) => c.clientId === "2")!;
    expect(c2.spark).toEqual([0.5, 0.1]);
    expect(c2.participationDeltaPts).toBeCloseTo(-40, 5);
    expect(c2.declining).toBe(true);
    expect(c2.users).toBe(100);
  });
  it("reads renewal and signals from the right place", () => {
    const withData = buildAccountCards([client("1", withRenewal("2026-12-15")), client("9", withRenewal("2025-01-01"))], rows, Q4, new Map([["1", { openTasks: 2, overdueTasks: 1, nextDue: null, lastNoteAt: "2026-10-23T00:00:00Z" }]]), TODAY);
    const c1 = withData.find((c) => c.clientId === "1")!;
    expect(c1).toMatchObject({ renewalDays: 43, openTasks: 2, overdueTasks: 1, daysSinceNote: 10 });
    expect(withData.find((c) => c.clientId === "9")!.renewalDays).toBeNull();
  });
});

describe("bookSummary", () => {
  it("counts accounts needing attention, renewals within 90 days and tasks", () => {
    const s = bookSummary([card({ risk: "critical", renewalDays: 20, openTasks: 2, overdueTasks: 1 }), card({ risk: "at_risk", renewalDays: 120 }), card({ risk: "healthy", renewalDays: 60, openTasks: 1 })]);
    expect(s).toEqual({ accounts: 3, needAttention: 2, renewing90: 2, openTasks: 3, overdueTasks: 1 });
  });
});

describe("weekAgenda", () => {
  it("lists overdue tasks first, then struggling renewals, and flags quiet accounts", () => {
    const items = weekAgenda([
      card({ clientId: "a", name: "A", daysSinceNote: 45 }),
      card({ clientId: "b", name: "B", risk: "critical", renewalDays: 12 }),
      card({ clientId: "c", name: "C", overdueTasks: 2 }),
      card({ clientId: "d", name: "D", renewalDays: 25 }),
    ], TODAY);
    expect(items.map((i) => i.text)).toEqual(["2 overdue tasks", "Renews in 12 days", "Renews in 25 days", "No note for 45 days"]);
    expect(items[0].urgent).toBe(true);
    expect(items[2].urgent).toBe(false);
  });
  it("mentions an account with no note at all only when it is struggling, and never one with no data", () => {
    const items = weekAgenda([card({ clientId: "a", daysSinceNote: null }), card({ clientId: "b", risk: "critical", daysSinceNote: null }), card({ clientId: "z", noData: true, daysSinceNote: null })], TODAY);
    expect(items.map((i) => i.clientId)).toEqual(["b"]);
    expect(items[0].text).toBe("No note recorded yet");
  });
  it("includes a task due within a week", () => {
    expect(weekAgenda([card({ nextTaskDue: "2026-11-04" })], TODAY).map((i) => i.text)).toEqual(["A task is due in 2 days"]);
  });
  it("is empty when nothing needs doing", () => expect(weekAgenda([card()], TODAY)).toEqual([]));
});

describe("declineStreak and the watchlist", () => {
  const falling = [row("1", "2026-Q1", 0.8, null), row("1", "2026-Q2", 0.7, null), row("1", "2026-Q3", 0.6, null), row("1", "2026-Q4", 0.5, 0.9)];
  it("counts consecutive quarters of decline, ending at the chosen one", () => {
    expect(declineStreak(falling, Q4)).toBe(3);
    expect(declineStreak(falling, { year: 2026, quarter: 2 })).toBe(1);
    expect(declineStreak([row("1", "2026-Q3", 0.5, null), row("1", "2026-Q4", 0.6, null)], Q4)).toBe(0);
  });
  it("suggests Escalate, Review or Monitor", () => {
    expect(watchAction("critical", 0)).toBe("Escalate");
    expect(watchAction("at_risk", 0)).toBe("Review");
    expect(watchAction("moderate", 2)).toBe("Review");
    expect(watchAction("moderate", 1)).toBe("Monitor");
  });
  it("lists accounts that lost three points or more, worst first", () => {
    const clients = [client("1"), client("2")];
    const rows = [...falling, row("2", "2026-Q3", 0.7, 0.9), row("2", "2026-Q4", 0.69, 0.9)];
    const view = buildPortfolio(clients, rows, { client: null, industry: null, period: Q4 });
    const list = buildWatchlist(view.clients, rows, Q4);
    expect(list.map((w) => w.clientId)).toEqual(["1"]);
    expect(list[0]).toMatchObject({ streak: 3, csm: "Sarah K." });
    expect(list[0].changePts).toBeCloseTo(-10, 5);
  });
});

describe("renewals", () => {
  const clients = [client("1", withRenewal("2026-12-15", 12000)), client("2", withRenewal("2027-02-01", 8500, "AED")), client("3", withRenewal("2026-01-01")), client("4")];
  const view = buildPortfolio(clients, [], { client: null, industry: null, period: Q4 });

  it("lists upcoming renewals soonest first and drops past or missing dates", () => {
    expect(buildRenewals(clients, view.clients, TODAY, null).map((r) => r.clientId)).toEqual(["1", "2"]);
  });
  it("can be limited to a window", () => {
    expect(buildRenewals(clients, view.clients, TODAY, 60).map((r) => r.clientId)).toEqual(["1"]);
  });
  it("totals value separately for each currency", () => {
    const rows = buildRenewals(clients, view.clients, TODAY, null);
    expect(renewalValueByCurrency(rows)).toEqual([{ currency: "AED", total: 8500 }, { currency: "USD", total: 12000 }]);
  });
  it("has a neutral signal for an account with no tasks or notes", () => expect(NO_SIGNAL).toEqual({ openTasks: 0, overdueTasks: 0, nextDue: null, lastNoteAt: null }));
});
