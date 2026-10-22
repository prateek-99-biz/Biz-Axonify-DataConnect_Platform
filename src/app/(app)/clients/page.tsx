import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { loadContext, type SearchParams } from "@/server/services/context";
import { buildPortfolio } from "@/server/services/portfolio";
import { periodKey, periodLabel } from "@/server/metrics/period";
import { Badge, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { RiskBadge } from "@/components/ui/risk-badge";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { fmtNumber, fmtPct } from "@/lib/utils";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("clients:read");
  const loaded = await loadContext(await searchParams);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx } = loaded;
  const view = buildPortfolio(ctx.clients, ctx.rows, ctx.filters);
  const p = periodKey(ctx.filters.period);

  const rows: TableRow[] = view.clients.length + view.noDataClients.length === 0 ? [] : [
    ...view.clients.map((c) => ({
      id: c.client.id,
      href: `/clients/${c.client.id}?period=${p}`,
      cells: {
        name: { v: c.client.name }, industry: { v: c.client.industry }, csm: { v: c.client.csmName },
        users: { v: c.current.registeredUsers, node: fmtNumber(c.current.registeredUsers) },
        engagement: { v: c.current.engagementRate, node: fmtPct(c.current.engagementRate) },
        health: { v: c.current.healthScore, node: c.current.healthScore?.toFixed(0) ?? "—" },
        risk: { v: c.risk, node: <RiskBadge risk={c.risk} /> },
        mapped: { v: c.client.salesforceAccountId ? "Mapped" : "No Salesforce account", node: c.client.salesforceAccountId ? <Badge tone="good">Mapped</Badge> : <Badge tone="warn">No Salesforce account</Badge> },
      },
    })),
    ...view.noDataClients.map((c) => ({
      id: c.id, href: `/clients/${c.id}?period=${p}`,
      cells: {
        name: { v: c.name }, industry: { v: c.industry }, csm: { v: c.csmName }, users: { v: null }, engagement: { v: null }, health: { v: null },
        risk: { v: "unknown", node: <RiskBadge risk="unknown" /> },
        mapped: { v: c.salesforceAccountId ? "Mapped" : "No Salesforce account", node: c.salesforceAccountId ? <Badge tone="good">Mapped</Badge> : <Badge tone="warn">No Salesforce account</Badge> },
      },
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Client directory</h1>
          <p className="text-sm text-slate-500">{rows.length} clients · metrics for {periodLabel(ctx.filters.period)}</p>
        </div>
        <Link href={`/clients/compare?period=${p}`} className="text-sm underline">Compare clients</Link>
      </div>
      <Card>
        <CardHeader title="Clients" subtitle="Search and sort; open a client for its 360 profile" />
        {rows.length === 0 ? <EmptyState title="No clients match these filters" /> : (
          <DataTable canExport={can(user.role, "export:csv")} exportName={`clients-${p}`}
            columns={[
              { key: "name", header: "Client" }, { key: "industry", header: "Industry" }, { key: "csm", header: "CSM" },
              { key: "users", header: "Users", align: "right" }, { key: "engagement", header: "Engagement", align: "right" },
              { key: "health", header: "Health", align: "right" }, { key: "risk", header: "Risk" }, { key: "mapped", header: "CRM mapping" },
            ]} rows={rows} />
        )}
      </Card>
    </div>
  );
}
