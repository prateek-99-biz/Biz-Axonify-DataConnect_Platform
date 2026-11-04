import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { loadContext, type SearchParams } from "@/server/services/context";
import { buildPortfolio } from "@/server/services/portfolio";
import { buildAttention } from "@/server/services/attention";
import { delta } from "@/server/metrics/calculations";
import { periodKey, periodLabel, previousPeriod, yearAgo } from "@/server/metrics/period";
import { Badge, CALLOUT_WARN, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { DeltaChip, KpiCard, KpiStrip } from "@/components/ui/kpi";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { PeriodNotice } from "@/components/internal/period-notice";
import { RiskBadge } from "@/components/ui/risk-badge";
import { CompareBars, TrendChart } from "@/components/charts/charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { cn, fmtNumber, fmtPct, fmtHealth } from "@/lib/utils";
import { humanize, riskLabel } from "@/lib/labels";

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
  const attention = buildAttention(view.clients, new Date().toISOString().slice(0, 10), prevLabel);
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
      health: { v: c.current.healthScore, node: fmtHealth(c.current.healthScore) },
      risk: { v: riskLabel(c.risk), node: <RiskBadge risk={c.risk} /> },
      driver: { v: c.topFactor ? `${c.topFactor.label} ${c.topFactor.points > 0 ? "+" : ""}${c.topFactor.points.toFixed(1)}` : null },
    },
  }));

  const csmRows: TableRow[] = view.csmBooks.map((b) => ({
    id: b.csmEmail,
    cells: {
      csm: { v: b.csmName }, clients: { v: b.clients }, users: { v: b.current.registeredUsers, node: fmtNumber(b.current.registeredUsers) },
      engagement: { v: b.current.participationRate, node: fmtPct(b.current.participationRate) },
      health: { v: b.current.healthScore, node: fmtHealth(b.current.healthScore) },
      atRisk: { v: b.atRisk },
    },
  }));

  // Until industries are mapped everything is "Unknown", so the benchmark chart and column would only repeat that word.
  const showIndustry = view.clients.some((c) => c.client.industry !== "Unknown");
  const showCsm = view.clients.some((c) => c.client.csmName);
  // Columns with nothing in them for any client are left out, as Industry and CSM are.
  const showAdoption = view.clients.some((c) => c.current.featureAdoption != null);
  const showDriver = view.clients.some((c) => c.topFactor);
  const industryChart =view.industries.map((i) => ({
    industry: i.industry, [periodLabel(f.period)]: i.current.participationRate, [prevLabel]: i.previous.participationRate,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio Overview</h1>
          <p className="text-sm text-slate-500">
            {periodLabel(f.period)} · {view.clients.length} client{view.clients.length === 1 ? "" : "s"}
            {f.industry ? ` · ${f.industry}` : ""} · compared with {prevLabel} and {yaLabel}
          </p>
        </div>
        <p className="text-xs text-slate-500">Source: {humanize(ctx.source)} · as of {new Date(ctx.asOf).toISOString().slice(0, 16).replace("T", " ")} UTC · <Link href="/metrics" className="underline">What the Metrics Mean</Link></p>
      </div>

      {view.noDataClients.length > 0 && (
        <p role="status" className={cn("glass !rounded-xl px-4 py-2.5 text-xs", CALLOUT_WARN)}>
          {view.noDataClients.length} client{view.noDataClients.length === 1 ? " has" : "s have"} no data for this period and {view.noDataClients.length === 1 ? "is" : "are"} excluded: {view.noDataClients.map((c) => c.name).join(", ")}.
        </p>
      )}

      <PeriodNotice label={periodLabel(f.period)} progress={ctx.progress} asOf={ctx.asOf} />

      <NeedsAttention attention={attention} scopeCount={view.clients.length} periodLabel={periodLabel(f.period)} periodKey={periodKey(f.period)} healthAvailable={kpis.current.healthScore != null} />

      <section aria-label="Headline indicators" className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Participation" accent="green" value={fmtPct(kpis.current.participationRate)} hint="Training users ÷ active users" vsPrev={delta(kpis.current.participationRate, kpis.previous.participationRate)} vsYear={delta(kpis.current.participationRate, kpis.yearAgo.participationRate)} />
        <KpiCard label="Knowledge" accent="purple" value={fmtPct(kpis.current.avgKnowledge)} hint="Average current knowledge" vsPrev={delta(kpis.current.avgKnowledge, kpis.previous.avgKnowledge)} vsYear={delta(kpis.current.avgKnowledge, kpis.yearAgo.avgKnowledge)} />
        <KpiCard label="Health Score" accent="green" unit="abs" value={fmtHealth(kpis.current.healthScore)} hint="50% participation + 50% knowledge" vsPrev={delta(kpis.current.healthScore, kpis.previous.healthScore)} vsYear={delta(kpis.current.healthScore, kpis.yearAgo.healthScore)} />
        {kpis.current.healthScore == null && (
          <Card className="flex items-center p-5 sm:col-span-2">
            <p className="text-sm text-slate-600">
              Knowledge and Health Score are not available for {periodLabel(f.period)}. Axonify keeps only each learner&rsquo;s current score, so they appear for quarters the dashboard has refreshed in. <Link href="/metrics" className="underline">See what the metrics mean</Link>.
            </p>
          </Card>
        )}
      </section>

      <KpiStrip items={[
        { label: "Registered Users", value: fmtNumber(kpis.current.registeredUsers), vsPrev: delta(kpis.current.registeredUsers, kpis.previous.registeredUsers), unit: "pct" },
        { label: "Active Users", value: fmtNumber(kpis.current.activeUsers), vsPrev: delta(kpis.current.activeUsers, kpis.previous.activeUsers), unit: "pct" },
        { label: "Engagement Rate", accent: "orange", note: "Low signal", noteHint: "Active means a live account, so this sits near 100% for most clients. Use Participation instead.", value: fmtPct(kpis.current.engagementRate), vsPrev: delta(kpis.current.engagementRate, kpis.previous.engagementRate) },
        { label: "Retention Rate", value: fmtPct(kpis.current.retentionRate), vsPrev: delta(kpis.current.retentionRate, kpis.previous.retentionRate) },
        { label: "Feature Adoption", value: fmtPct(kpis.current.featureAdoption), vsPrev: delta(kpis.current.featureAdoption, kpis.previous.featureAdoption) },
      ]} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Portfolio Trend" subtitle="Quarterly participation, knowledge and engagement (ratio of sums across clients in scope)" />
          <div className="p-4"><TrendChart data={view.trend} series={[{ key: "participationRate", label: "Participation" }, { key: "avgKnowledge", label: "Knowledge" }, { key: "engagementRate", label: "Engagement" }]} /></div>
        </Card>
        <Card>
          <CardHeader title="Account Risk" subtitle="Clients by health band (Healthy 75+, Moderate 60+, At Risk 45+)" />
          {kpis.current.healthScore == null ? <p className="p-4 text-sm text-slate-600">Health bands aren’t available for {periodLabel(f.period)}, because knowledge is only recorded for the latest quarter.</p> : <div className="space-y-2 p-4 text-sm">
            {([["critical", "Critical"], ["at_risk", "At Risk"], ["moderate", "Moderate"], ["healthy", "Healthy"]] as const).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between"><RiskBadge risk={k} /><span className="tabular-nums">{view.riskCounts[k]} <span className="text-xs text-slate-400">{l}</span></span></div>
            ))}
          </div>}
          <p className="border-t hairline px-4 py-3 text-xs text-slate-500">Alerts for these clients are listed in the bell at the top of the page.</p>
        </Card>
      </div>

      {showIndustry && (
        <Card>
          <CardHeader title="Industry Benchmark" subtitle={`Participation by industry, ${periodLabel(f.period)} vs ${prevLabel}`} />
          <div className="p-4"><CompareBars entities data={industryChart} xKey="industry" series={[{ key: periodLabel(f.period), label: periodLabel(f.period) }, { key: prevLabel, label: prevLabel }]} /></div>
        </Card>
      )}

      <Card>
        <CardHeader title="Clients" subtitle="Select a client to drill into teams, users and engagement" action={<Link href={`/clients/compare?period=${periodKey(f.period)}`} className="text-xs underline">Compare clients</Link>} />
        <DataTable canExport={canExport} exportName={`portfolio-${periodKey(f.period)}`}
          columns={[
            { key: "name", header: "Client" }, ...(showIndustry ? [{ key: "industry", header: "Industry" }] : []), ...(showCsm ? [{ key: "csm", header: "CSM" }] : []),
            { key: "users", header: "Users", align: "right" as const }, { key: "engagement", header: "Participation", align: "right" as const },
            { key: "change", header: `Δ vs ${prevLabel}`, align: "right" as const }, { key: "knowledge", header: "Knowledge", align: "right" as const }, { key: "retention", header: "Retention", align: "right" as const },
            ...(showAdoption ? [{ key: "adoption", header: "Adoption", align: "right" as const }] : []), { key: "health", header: "Health", align: "right" as const },
            { key: "risk", header: "Risk" }, ...(showDriver ? [{ key: "driver", header: "Main Driver (pts)", hint: "Factor with the largest weighted change in health score" }] : []),
          ]}
          rows={rows} />
      </Card>

      <Card>
        <CardHeader title="CSM Books of Business" subtitle="Clients in scope grouped by owner (CSM ownership is mock data in development)" />
        <DataTable searchable={false} canExport={canExport} exportName={`csm-books-${periodKey(f.period)}`}
          columns={[{ key: "csm", header: "CSM" }, { key: "clients", header: "Clients", align: "right" }, { key: "users", header: "Users", align: "right" }, { key: "engagement", header: "Participation", align: "right" }, { key: "health", header: "Health", align: "right" }, { key: "atRisk", header: "At Risk / Critical", align: "right" }]}
          rows={csmRows} />
      </Card>
    </div>
  );
}
