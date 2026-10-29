import type { ClientPeriodRow, ClientSummary } from "@/server/data/ports";
import { aggregate, contributingFactor, delta, type DerivedMetrics, type Delta, type RiskLevel } from "@/server/metrics/calculations";
import { periodKey, previousPeriod, quarterRange, quartersIn, yearAgo, type Period } from "@/server/metrics/period";
import { RISK_THRESHOLDS } from "@/server/metrics/definitions";

export interface Filters {
  /** client id or null = all */
  client: string | null;
  /** industry name or null = all */
  industry: string | null;
  period: Period;
}

export interface ClientRowView {
  client: ClientSummary;
  current: DerivedMetrics;
  previous: DerivedMetrics;
  healthDelta: Delta;
  participationDelta: Delta;
  topFactor: { label: string; points: number } | null;
  risk: RiskLevel;
  declining: boolean;
}

export interface KpiSet {
  current: DerivedMetrics;
  previous: DerivedMetrics;
  yearAgo: DerivedMetrics;
}

export interface PortfolioView {
  scopeClientCount: number;
  kpis: KpiSet;
  trend: { period: string; engagementRate: number | null; participationRate: number | null; avgKnowledge: number | null; retentionRate: number | null; featureAdoption: number | null; healthScore: number | null; activeUsers: number }[];
  industries: { industry: string; clients: number; current: DerivedMetrics; previous: DerivedMetrics }[];
  clients: ClientRowView[];
  csmBooks: { csmName: string; csmEmail: string; clients: number; current: DerivedMetrics; atRisk: number }[];
  riskCounts: Record<RiskLevel, number>;
  /** Clients with no data in the selected period (never shown as zeros). */
  noDataClients: ClientSummary[];
}

/** Participation drop (absolute, in ratio points) between periods that flags "declining"; matches the report's Team Trend (3 pts). */
export const DECLINE_THRESHOLD = -0.03;

export function scopeClients(clients: ClientSummary[], f: Pick<Filters, "client" | "industry">) {
  return clients.filter((c) => (!f.client || c.id === f.client) && (!f.industry || c.industry === f.industry));
}

export function buildPortfolio(clients: ClientSummary[], rows: ClientPeriodRow[], f: Filters): PortfolioView {
  const scoped = scopeClients(clients, f);
  const ids = new Set(scoped.map((c) => c.id));
  const scopedRows = rows.filter((r) => ids.has(r.clientId));
  const byClient = new Map<string, ClientPeriodRow[]>();
  for (const r of scopedRows) byClient.set(r.clientId, [...(byClient.get(r.clientId) ?? []), r]);

  const cur = quartersIn(f.period);
  const prev = quartersIn(previousPeriod(f.period));
  const ya = quartersIn(yearAgo(f.period));

  const kpis: KpiSet = { current: aggregate(scopedRows, cur), previous: aggregate(scopedRows, prev), yearAgo: aggregate(scopedRows, ya) };

  const endQ = f.period.quarter ? f.period : { year: f.period.year, quarter: 4 as const };
  const allQ = [...new Set(scopedRows.map((r) => r.period))].sort();
  const startKey = allQ.find((q) => q >= `${endQ.year - 2}-Q1`) ?? allQ[0];
  const trendKeys = startKey ? quarterRange({ year: Number(startKey.slice(0, 4)), quarter: Number(startKey.slice(6)) as 1 }, endQ) : [];
  const trend = trendKeys
    .filter((q) => scopedRows.some((r) => r.period === q))
    .map((q) => {
      const m = aggregate(scopedRows, [q]);
      return { period: q, engagementRate: m.engagementRate, participationRate: m.participationRate, avgKnowledge: m.avgKnowledge, retentionRate: m.retentionRate, featureAdoption: m.featureAdoption, healthScore: m.healthScore, activeUsers: m.activeUsers };
    });

  const hasData = (id: string, qs: string[]) => (byClient.get(id) ?? []).some((r) => qs.includes(r.period));
  const noDataClients = scoped.filter((c) => !hasData(c.id, cur));

  const clientViews: ClientRowView[] = scoped
    .filter((c) => hasData(c.id, cur))
    .map((client) => {
      const cr = byClient.get(client.id) ?? [];
      const current = aggregate(cr, cur);
      const previous = aggregate(cr, prev);
      const participationDelta = delta(current.participationRate, previous.participationRate);
      const factor = previous.healthScore != null ? contributingFactor(current, previous)[0] : null;
      return {
        client, current, previous,
        healthDelta: delta(current.healthScore, previous.healthScore),
        participationDelta,
        topFactor: factor ? { label: factor.label, points: factor.points } : null,
        risk: current.risk,
        declining: participationDelta.abs != null && participationDelta.abs <= DECLINE_THRESHOLD,
      };
    });

  const industryNames = [...new Set(clientViews.map((c) => c.client.industry))].sort();
  const industries = industryNames.map((industry) => {
    const members = clientViews.filter((c) => c.client.industry === industry).map((c) => c.client.id);
    const rr = scopedRows.filter((r) => members.includes(r.clientId));
    return { industry, clients: members.length, current: aggregate(rr, cur), previous: aggregate(rr, prev) };
  });

  const csmKeys = [...new Set(clientViews.map((c) => c.client.csmEmail))].sort();
  const csmBooks = csmKeys.map((email) => {
    const mine = clientViews.filter((c) => c.client.csmEmail === email);
    const rr = scopedRows.filter((r) => mine.some((m) => m.client.id === r.clientId));
    return {
      csmEmail: email, csmName: mine[0].client.csmName, clients: mine.length, current: aggregate(rr, cur),
      atRisk: mine.filter((m) => m.risk === "critical" || m.risk === "at_risk").length,
    };
  });

  const riskCounts: Record<RiskLevel, number> = { healthy: 0, moderate: 0, at_risk: 0, critical: 0, unknown: 0 };
  clientViews.forEach((c) => riskCounts[c.risk]++);

  return { scopeClientCount: scoped.length, kpis, trend, industries, clients: clientViews, csmBooks, riskCounts, noDataClients };
}

export interface DerivedAlert {
  key: string;
  clientId: string;
  clientName: string;
  severity: "warning" | "critical";
  title: string;
  detail: string;
}

/** Alerts are derived from metrics (no stored alert rules yet). Key is stable per client+period so acks persist. */
export function deriveAlerts(view: PortfolioView, period: Period): DerivedAlert[] {
  const p = periodKey(period);
  const out: DerivedAlert[] = [];
  for (const c of view.clients) {
    if (c.risk === "critical") {
      out.push({ key: `risk:${c.client.id}:${p}`, clientId: c.client.id, clientName: c.client.name, severity: "critical",
        title: "Critical Health Score", detail: `Health ${c.current.healthScore?.toFixed(0)} is in the Critical band (below ${RISK_THRESHOLDS.atRisk}).` });
    }
    if (c.declining) {
      out.push({ key: `decline:${c.client.id}:${p}`, clientId: c.client.id, clientName: c.client.name, severity: "warning",
        title: "Declining Participation", detail: `Participation fell ${Math.abs((c.participationDelta.abs ?? 0) * 100).toFixed(1)} pts vs the previous period.` });
    }
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}
