/**
 * DEVELOPMENT-ONLY mock adapter. Deterministic synthetic data; none of it is real.
 * Client names are fictional. Selected only when DATA_ADAPTER=mock (refused in production).
 */
import type {
  AnalyticsPort, ClientPeriodRow, ClientSummary, CrmPort, Result, SourceCoverageRow, TeamNode, UserRow, UserLifecycle,
} from "../../ports";
import { quarterRange } from "@/server/metrics/period";

const SOURCE = "mock" as const;
export const MOCK_AS_OF = "2026-10-20T06:00:00.000Z";
const QUARTERS = quarterRange({ year: 2023, quarter: 1 }, { year: 2026, quarter: 3 });

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INDUSTRIES = ["Retail", "Hospitality", "Healthcare", "Logistics", "Manufacturing", "Financial Services"];
const CSMS = [
  { email: "csm.a@bizgroup.ae", name: "Alex Carter" },
  { email: "csm.b@bizgroup.ae", name: "Jordan Lee" },
  { email: "csm.c@bizgroup.ae", name: "Sam Rivera" },
];
const NAMES = [
  "Northwind Retail", "Harbor Hotels", "Meridian Health", "Atlas Freight", "Summit Foods", "Crescent Bank",
  "Bluebird Stores", "Oasis Resorts", "Vertex Clinics", "Pioneer Logistics", "Ironworks Mfg", "Keystone Capital",
  "Maple Market", "Sunrise Suites", "CarePoint Group", "Swift Cargo", "Forge Industries", "Anchor Financial",
  "Greenleaf Grocers", "Skyline Hospitality", "Lumen Medical", "Transit Hub", "Granite Works", "Beacon Credit",
];

interface Profile { base: number; engagement: number; trend: number; retention: number; adoption: number }

const CLIENTS: (ClientSummary & { profile: Profile })[] = NAMES.map((name, i) => {
  const r = rng(`client-${i}`);
  const csm = CSMS[i % CSMS.length];
  return {
    id: `c_${String(i + 1).padStart(3, "0")}`,
    name,
    industry: INDUSTRIES[i % INDUSTRIES.length],
    csmEmail: csm.email,
    csmName: csm.name,
    axonifyTenantId: `mock-tenant-${i + 1}`,
    // Deliberately leave a few unmapped so reconciliation views have something real to show.
    salesforceAccountId: i % 9 === 8 ? null : `mock-sf-${String(i + 1).padStart(4, "0")}`,
    profile: {
      base: Math.round(150 + r() * 2800),
      engagement: 0.35 + r() * 0.5,
      trend: (r() - 0.55) * 0.02,
      retention: 0.6 + r() * 0.3,
      adoption: 0.3 + r() * 0.5,
    },
  };
});

function rowsFor(c: (typeof CLIENTS)[number]): ClientPeriodRow[] {
  const r = rng(`rows-${c.id}`);
  const out: ClientPeriodRow[] = [];
  let prevActive = 0;
  QUARTERS.forEach((period, qi) => {
    const registered = Math.round(c.profile.base * (1 + qi * 0.012) + r() * 10);
    const eng = Math.min(0.97, Math.max(0.05, c.profile.engagement + c.profile.trend * qi + (r() - 0.5) * 0.04));
    const active = Math.round(registered * eng);
    const ret = Math.min(0.98, Math.max(0.2, c.profile.retention + c.profile.trend * qi * 0.6 + (r() - 0.5) * 0.04));
    const featuresAvailable = 14;
    const featuresUsed = Math.min(featuresAvailable, Math.max(1, Math.round(featuresAvailable * (c.profile.adoption + c.profile.trend * qi * 0.5 + (r() - 0.5) * 0.06))));
    out.push({
      clientId: c.id,
      period,
      registeredUsers: registered,
      activeUsers: active,
      previousActiveUsers: prevActive,
      retainedUsers: Math.round(prevActive * ret),
      sessions: Math.round(active * (6 + r() * 14)),
      featuresAvailable,
      featuresUsed,
    });
    prevActive = active;
  });
  return out;
}

const ROWS = CLIENTS.flatMap(rowsFor);

const ok = <T,>(data: T): Result<T> => ({ status: "ok", data, source: SOURCE, asOf: MOCK_AS_OF });

const TEAM_NAMES = ["Operations", "Sales Floor", "Support", "Warehouse", "Front of House", "Compliance"];

function teamTree(clientId: string, period: string): TeamNode[] {
  const c = CLIENTS.find((x) => x.id === clientId);
  const row = ROWS.find((x) => x.clientId === clientId && x.period === period);
  if (!c || !row) return [];
  const r = rng(`teams-${clientId}`);
  const regions = ["North", "South", "East", "West"].slice(0, 2 + Math.floor(r() * 3));
  const nodes: TeamNode[] = [];
  const weights: { id: string; w: number }[] = [];
  nodes.push({ id: `${clientId}-root`, name: c.name, parentId: null, registeredUsers: 0, activeUsers: 0 });
  regions.forEach((reg, ri) => {
    const rid = `${clientId}-r${ri}`;
    nodes.push({ id: rid, name: `${reg} Region`, parentId: `${clientId}-root`, registeredUsers: 0, activeUsers: 0 });
    TEAM_NAMES.slice(0, 2 + Math.floor(r() * 3)).forEach((tn, ti) => {
      const id = `${rid}-t${ti}`;
      nodes.push({ id, name: tn, parentId: rid, registeredUsers: 0, activeUsers: 0 });
      weights.push({ id, w: 0.3 + r() });
    });
  });
  const total = weights.reduce((s, x) => s + x.w, 0);
  const leafIds = new Set(weights.map((x) => x.id));
  let regLeft = row.registeredUsers;
  let actLeft = row.activeUsers;
  weights.forEach((w, i) => {
    const isLast = i === weights.length - 1;
    const reg = isLast ? regLeft : Math.round((row.registeredUsers * w.w) / total);
    const teamEng = Math.min(0.98, (row.activeUsers / row.registeredUsers) * (0.7 + r() * 0.6));
    const act = isLast ? Math.min(reg, actLeft) : Math.min(reg, Math.round(reg * teamEng));
    regLeft -= reg;
    actLeft -= act;
    const n = nodes.find((x) => x.id === w.id)!;
    n.registeredUsers = reg;
    n.activeUsers = Math.max(0, act);
  });
  // Roll up leaf counts to parents.
  for (const n of [...nodes].reverse()) {
    if (leafIds.has(n.id) || !n.parentId) continue;
    const kids = nodes.filter((x) => x.parentId === n.id);
    n.registeredUsers = kids.reduce((s, k) => s + k.registeredUsers, 0);
    n.activeUsers = kids.reduce((s, k) => s + k.activeUsers, 0);
  }
  const root = nodes[0];
  const regions2 = nodes.filter((x) => x.parentId === root.id);
  root.registeredUsers = regions2.reduce((s, k) => s + k.registeredUsers, 0);
  root.activeUsers = regions2.reduce((s, k) => s + k.activeUsers, 0);
  return nodes;
}

function users(clientId: string, period: string): UserRow[] {
  const tree = teamTree(clientId, period);
  const leaves = tree.filter((n) => !tree.some((x) => x.parentId === n.id));
  const r = rng(`users-${clientId}-${period}`);
  const out: UserRow[] = [];
  leaves.forEach((leaf) => {
    const shown = Math.min(leaf.registeredUsers, 25); // sample for the UI
    for (let i = 0; i < shown; i++) {
      const roll = r();
      const lifecycle: UserLifecycle =
        roll < 0.1 ? "new" : roll < 0.55 ? "active" : roll < 0.7 ? "at_risk" : roll < 0.9 ? "dormant" : "never_active";
      const daysAgo = lifecycle === "never_active" ? null : Math.floor(r() * (lifecycle === "dormant" ? 200 : lifecycle === "at_risk" ? 60 : 14));
      const last = daysAgo == null ? null : new Date(Date.parse(MOCK_AS_OF) - daysAgo * 86400000).toISOString();
      out.push({
        id: `${leaf.id}-u${i}`,
        displayName: `User ${leaf.id.slice(-6)}-${i + 1}`,
        teamId: leaf.id,
        registeredAt: new Date(Date.parse(MOCK_AS_OF) - (30 + Math.floor(r() * 700)) * 86400000).toISOString(),
        lastActiveAt: last,
        sessionsInPeriod: lifecycle === "never_active" || lifecycle === "dormant" ? 0 : 1 + Math.floor(r() * 40),
        lifecycle,
      });
    }
  });
  return out;
}

function coverage(): SourceCoverageRow[] {
  const sources = ["users", "activity", "teams", "feature usage"];
  const out: SourceCoverageRow[] = [];
  CLIENTS.forEach((c, ci) => {
    const r = rng(`cov-${c.id}`);
    sources.forEach((s) => {
      const stale = ci % 7 === 3 && s === "activity";
      const missing = ci % 11 === 5 && s === "teams";
      const lastRow = ROWS.filter((x) => x.clientId === c.id).at(-1)!;
      const expected = s === "users" ? lastRow.registeredUsers : lastRow.sessions;
      out.push({
        clientId: c.id,
        source: s,
        lastLoadedAt: missing ? null : new Date(Date.parse(MOCK_AS_OF) - (stale ? 9 : r() * 1.5) * 86400000).toISOString(),
        rowCount: missing ? 0 : Math.round(expected * (ci % 5 === 2 && s === "users" ? 0.93 : 1)),
        expectedRowCount: expected,
      });
    });
  });
  return out;
}

export const mockAnalytics: AnalyticsPort = {
  kind: SOURCE,
  async listClients() {
    return ok(CLIENTS.map(({ profile: _p, ...c }) => c));
  },
  async getClientPeriodRows(clientIds) {
    const set = clientIds ? new Set(clientIds) : null;
    return ok(ROWS.filter((r) => !set || set.has(r.clientId)));
  },
  async getTeamTree(clientId, period) {
    return ok(teamTree(clientId, period));
  },
  async getUsers(clientId, period) {
    return ok(users(clientId, period));
  },
  async getSourceCoverage() {
    return ok(coverage());
  },
};

export const mockCrm: CrmPort = {
  kind: SOURCE,
  async getAccount() {
    return {
      status: "unavailable",
      reason: "No CRM data is generated by the Phase 1 mock adapter. Contracts, renewals and ARR arrive with the Salesforce integration (Phase 3).",
      source: SOURCE,
    };
  },
};
