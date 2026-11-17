/**
 * Renders every Insights page (and the Alerts page that shows usage drops) against the development mock data, so a page
 * that throws, or loses its main sections, fails here rather than in front of a CSM. Auth, cookies and the database are
 * replaced; the numbers come from the real mock adapter and the real insight functions.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => "/insights", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/server/auth/guard", () => ({ requirePagePermission: async () => ({ id: "u1", email: "csm.a@bizgroup.ae", role: "ADMIN" }) }));
vi.mock("@/server/services/salesforce-accounts", () => ({ sampleCount: async () => 0 }));
vi.mock("@/server/services/alert-acks", () => ({ ackedAlertKeys: async () => [] }));
vi.mock("@/server/services/account-signals", () => ({
  touchpoints: async (ids: string[]) => new Map(ids.slice(0, 3).map((id, i) => [id, { notes: i + 1, tasks: i }])),
  accountSignals: async () => new Map(),
}));
vi.mock("@/server/data", async () => {
  const { mockAnalytics, mockCrm } = await import("@/server/data/adapters/mock");
  // The mock adapter has no Salesforce data; give every client a contract so Cost to Serve and renewals have rows.
  const analytics = {
    ...mockAnalytics,
    async listClients() {
      const r = await mockAnalytics.listClients();
      if (r.status !== "ok") return r;
      return { ...r, data: r.data.map((c, i) => ({ ...c, commercial: { licenses: 400 + i * 150, licenseValue: 20000 + i * 5000, currency: "USD", region: null, contractStart: null, renewalDate: `2027-0${(i % 9) + 1}-15` } })) };
    },
  };
  return { getAdapters: () => ({ analytics, crm: mockCrm }) };
});

const render = async (mod: Promise<{ default: (p: { searchParams: Promise<Record<string, string>> }) => Promise<ReactElement> }>, sp: Record<string, string> = {}) => {
  const Page = (await mod).default;
  return renderToString(await Page({ searchParams: Promise.resolve(sp) })).replace(/<!-- -->/g, "");
};

describe("Insights pages render with mock data", { timeout: 60_000 }, () => {
  const period = { period: "2026-Q2" };

  it("Client Leaderboard ranks clients on AI, engagement, growth and communications", async () => {
    const html = await render(import("./leaderboard/page"), period);
    for (const text of ["Client Leaderboard", "Who Leads", "Most AI Use", "Widest Max Adoption", "Best Participation", "Highest Engagement", "Biggest Growth This Year", "Most Communications Use", "Rank Every Client", "Overall Standings"]) expect(html).toContain(text);
    const byGrowth = await render(import("./leaderboard/page"), { ...period, by: "userGrowth" });
    expect(byGrowth).toContain("Which client has grown the most this year?");
  });

  it("Account Health shows the summary, the focus account and every account", async () => {
    const html = await render(import("./health/page"), period);
    for (const text of ["Account Health", "In Plain Words", "Account in Focus", "What Makes Up the Health Score", "Other Signals Worth Watching", "Month by Month", "All Accounts"]) expect(html).toContain(text);
    expect(await render(import("./health/page"), { ...period, focus: "c_005" })).toContain("Summit Foods");
  });

  it("Benchmarks compares a client with its peers feature by feature", async () => {
    const html = await render(import("./benchmarks/page"), { ...period, focus: "c_001" });
    for (const text of ["Benchmarks and Features", "Northwind Retail", "Other Retail Clients", "Feature Utilisation", "Communication Utilisation", "Max AI Assistant"]) expect(html).toContain(text);
  });

  it("Max AI Usage lists every client and who is not using Max", async () => {
    const html = await render(import("./ai/page"), period);
    for (const text of ["Max AI Usage", "Questions Asked", "Max Adoption by Client", "Every Client", "From Client Content"]) expect(html).toContain(text);
  });

  it("CSM Portfolio and Cost to Serve show books, renewals and contract value", async () => {
    const csm = await render(import("./csm/page"), period);
    for (const text of ["CSM Portfolio", "Alex Carter", "CSM Performance", "Upcoming Renewals"]) expect(csm).toContain(text);
    const cost = await render(import("./cost/page"), period);
    for (const text of ["Cost to Serve", "Annual Contract Value", "Value at Risk", "Account Economics", "Licence Use", "What Is Not Here Yet"]) expect(cost).toContain(text);
  });

  it("Alerts and Watchlist includes the usage drops section", async () => {
    const html = await render(import("../alerts/page"), period);
    expect(html).toContain("Usage Drops");
  });
});
