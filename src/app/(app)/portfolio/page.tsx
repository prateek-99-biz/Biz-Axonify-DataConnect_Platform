import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { loadContext, type SearchParams } from "@/server/services/context";
import { buildPortfolio, deriveAlerts } from "@/server/services/portfolio";
import { delta } from "@/server/metrics/calculations";
import { periodKey, periodLabel, previousPeriod, yearAgo } from "@/server/metrics/period";
import { Badge, CALLOUT_WARN, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { DeltaChip, KpiCard } from "@/components/ui/kpi";
import { RiskBadge } from "@/components/ui/risk-badge";
import { CompareBars, TrendChart } from "@/components/charts/charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { cn, fmtNumber, fmtPct } from "@/lib/utils";

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("portfolio:read");
  const loaded = await loadContext(await searchParams);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx } = loaded;
  const f = ctx.filters;
  const view = buildPortfolio(ctx.clients, ctx.rows, f);
  const { kpis } = view;
  const prevLabel = periodLabel(previousPeriod(f.period));
  const yaLabel = periodLabel(yearAgo(f.period));
  const alerts = deriveAlerts(view, f.period);
  const canExport = can(user.role, "export:csv");

  if (view.scopeClientCount === 0) {
    return <EmptyState title="No clients match these filters">Clear the client or industry filter to see the portfolio.</EmptyState>;
  }
  if (view.clients.length === 0) {
    return <EmptyState title={`No data for ${periodLabel(f.period)}`}>None of the {view.scopeClientCount} clients in scope have records for this period. Choose an earlier period.</EmptyState>;
  }

  const rows: TableRow[] = view.clients.map((c) => ({
    id: c.client.id,
    href: `/clients/${c.client.id}?period=${periodKey(f.period)}`,
    cells: {
      name: { v: c.client.name },
      industry: { v: c.client.industry },
      csm: { v: c.client.csmName },
      users: { v: c.current.registeredUsers, node: fmtNumber(c.current.registeredUsers) },
      engagement: { v: c.current.participationRate, node: fmtPct(c.current.participationRate) },
      change: { v: c.participationDelta.abs, node: <DeltaChip d={c.participationDelta} /> },
      knowledge: { v: c.current.avgKnowledge, node: fmtPct(c.current.avgKnowledge) },
      retention: { v: c.current.retentionRate, node: fmtPct(c.current.retentionRate) },
      adoption: { v: c.current.featureAdoption, node: fmtPct(c.current.featureAdoption) },
      health: { v: c.current.healthScore, node: c.current.healthScore?.toFixed(0) ?? "—" },
      risk: { v: c.risk, node: <RiskBadge risk={c.risk} /> },
      driver: { v: c.topFactor ? `${c.topFactor.label} ${c.topFactor.points > 0 ? "+" : ""}${c.topFactor.points.toFixed(1)}` : null },
    },
  }));

  const csmRows: TableRow[] = view.csmBooks.map((b) => ({
    id: b.csmEmail,
    cells: {
      csm: { v: b.csmName }, clients: { v: b.clients }, users: { v: b.current.registeredUsers, node: fmtNumber(b.current.registeredUsers) },
      engagement: { v: b.current.participationRate, node: fmtPct(b.current.participationRate) },
      health: { v: b.current.healthScore, node: b.current.healthScore?.toFixed(0) ?? "—" },
      atRisk: { v: b.atRisk },
    },
  }));

  const industryChart = view.industries.map((i) => ({
    industry: i.industry, [periodLabel(f.period)]: i.current.participationRate, [prevLabel]: i.previous.participationRate,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio overview</h1>
          <p className="text-sm text-slate-500">
            {periodLabel(f.period)} · {view.clients.length} client{view.clients.length === 1 ? "" : "s"}
            {f.industry ? ` · ${f.industry}` : ""} · compared with {prevLabel} and {yaLabel}
          </p>
        </div>
        <p className="text-xs text-slate-500">Source: {ctx.source} · as of {new Date(ctx.asOf).toISOString().slice(0, 16).replace("T", " ")} UTC · <Link href="/data-reliability#definitions" className="underline">metric definitions</Link></p>
      </div>

      {view.noDataClients.length > 0 && (
        <p role="status" className={cn("glass !rounded-xl px-4 py-2.5 text-xs", CALLOUT_WARN)}>
          {view.noDataClients.length} client{view.noDataClients.length === 1 ? " has" : "s have"} no data for this period and {view.noDataClients.length === 1 ? "is" : "are"} excluded: {view.noDataClients.map((c) => c.name).join(", ")}.
        </p>
      )}

      <section aria-label="Key indicators" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Registered users" unit="pct" value={fmtNumber(kpis.current.registeredUsers)} vsPrev={delta(kpis.current.registeredUsers, kpis.previous.registeredUsers)} vsYear={delta(kpis.current.registeredUsers, kpis.yearAgo.registeredUsers)} />
        <KpiCard label="Active users" unit="pct" value={fmtNumber(kpis.current.activeUsers)} vsPrev={delta(kpis.current.activeUsers, kpis.previous.activeUsers)} vsYear={delta(kpis.current.activeUsers, kpis.yearAgo.activeUsers)} />
        <KpiCard label="Participation" value={fmtPct(kpis.current.participationRate)} hint="training_users / active_users" vsPrev={delta(kpis.current.participationRate, kpis.previous.participationRate)} vsYear={delta(kpis.current.participationRate, kpis.yearAgo.participationRate)} />
        <KpiCard label="Knowledge" value={fmtPct(kpis.current.avgKnowledge)} hint="Average current knowledge" vsPrev={delta(kpis.current.avgKnowledge, kpis.previous.avgKnowledge)} vsYear={delta(kpis.current.avgKnowledge, kpis.yearAgo.avgKnowledge)} />
        <KpiCard label="Engagement rate" value={fmtPct(kpis.current.engagementRate)} hint="active_users / registered_users" vsPrev={delta(kpis.current.engagementRate, kpis.previous.engagementRate)} vsYear={delta(kpis.current.engagementRate, kpis.yearAgo.engagementRate)} />
        <KpiCard label="Retention rate" value={fmtPct(kpis.current.retentionRate)} hint="retained_users / previous_active_users" vsPrev={delta(kpis.current.retentionRate, kpis.previous.retentionRate)} vsYear={delta(kpis.current.retentionRate, kpis.yearAgo.retentionRate)} />
        <KpiCard label="Feature adoption" value={fmtPct(kpis.current.featureAdoption)} hint="features_used / features_available" vsPrev={delta(kpis.current.featureAdoption, kpis.previous.featureAdoption)} vsYear={delta(kpis.current.featureAdoption, kpis.yearAgo.featureAdoption)} />
        <KpiCard label="Health score" unit="abs" value={kpis.current.healthScore?.toFixed(0) ?? "—"} hint="50% participation + 50% knowledge" vsPrev={delta(kpis.current.healthScore, kpis.previous.healthScore)} vsYear={delta(kpis.current.healthScore, kpis.yearAgo.healthScore)} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Portfolio trend" subtitle="Quarterly participation, knowledge and engagement (ratio of sums across clients in scope)" />
          <div className="p-4"><TrendChart data={view.trend} series={[{ key: "participationRate", label: "Participation" }, { key: "avgKnowledge", label: "Knowledge" }, { key: "engagementRate", label: "Engagement" }]} /></div>
        </Card>
        <Card>
          <CardHeader title="Account risk" subtitle="Clients by health band (Healthy 75+, Moderate 60+, At risk 45+)" />
          <div className="space-y-2 p-4 text-sm">
            {([["critical", "Critical"], ["at_risk", "At risk"], ["moderate", "Moderate"], ["healthy", "Healthy"]] as const).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between"><RiskBadge risk={k} /><span className="tabular-nums">{view.riskCounts[k]} <span className="text-xs text-slate-400">{l}</span></span></div>
            ))}
          </div>
          <div className="border-t hairline">
            <p className="px-4 pt-3 text-xs font-medium text-slate-500">Open alerts ({alerts.length})</p>
            <ul className="max-h-44 divide-y divide-line overflow-y-auto">
              {alerts.length === 0 && <li className="px-4 py-3 text-xs text-slate-500">No alerts for this period.</li>}
              {alerts.slice(0, 8).map((a) => (
                <li key={a.key} className="px-4 py-2 text-xs">
                  <Badge tone={a.severity === "critical" ? "critical" : "warn"}>{a.title}</Badge>{" "}
                  <Link href={`/clients/${a.clientId}?period=${periodKey(f.period)}`} className="font-medium hover:underline">{a.clientName}</Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Industry benchmark" subtitle={`Participation by industry, ${periodLabel(f.period)} vs ${prevLabel}`} />
        <div className="p-4"><CompareBars data={industryChart} xKey="industry" series={[{ key: periodLabel(f.period), label: periodLabel(f.period) }, { key: prevLabel, label: prevLabel, color: "#1D2B43" }]} /></div>
      </Card>

      <Card>
        <CardHeader title="Clients" subtitle="Select a client to drill into teams, users and engagement" action={<Link href={`/clients/compare?period=${periodKey(f.period)}`} className="text-xs underline">Compare clients</Link>} />
        <DataTable canExport={canExport} exportName={`portfolio-${periodKey(f.period)}`}
          columns={[
            { key: "name", header: "Client" }, { key: "industry", header: "Industry" }, { key: "csm", header: "CSM" },
            { key: "users", header: "Users", align: "right" }, { key: "engagement", header: "Participation", align: "right" },
            { key: "change", header: `Δ vs ${prevLabel}`, align: "right" }, { key: "knowledge", header: "Knowledge", align: "right" }, { key: "retention", header: "Retention", align: "right" },
            { key: "adoption", header: "Adoption", align: "right" }, { key: "health", header: "Health", align: "right" },
            { key: "risk", header: "Risk" }, { key: "driver", header: "Main driver (pts)", hint: "Factor with the largest weighted change in health score" },
          ]}
          rows={rows} />
      </Card>

      <Card>
        <CardHeader title="CSM books of business" subtitle="Clients in scope grouped by owner (CSM ownership is mock data in development)" />
        <DataTable searchable={false} canExport={canExport} exportName={`csm-books-${periodKey(f.period)}`}
          columns={[{ key: "csm", header: "CSM" }, { key: "clients", header: "Clients", align: "right" }, { key: "users", header: "Users", align: "right" }, { key: "engagement", header: "Participation", align: "right" }, { key: "health", header: "Health", align: "right" }, { key: "atRisk", header: "At risk / critical", align: "right" }]}
          rows={csmRows} />
      </Card>
    </div>
  );
}
