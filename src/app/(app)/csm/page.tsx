import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { loadContext, type SearchParams } from "@/server/services/context";
import { buildPortfolio } from "@/server/services/portfolio";
import { periodKey, periodLabel } from "@/server/metrics/period";
import { Badge, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { RiskBadge } from "@/components/ui/risk-badge";
import { CompareBars } from "@/components/charts/charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { fmtNumber, fmtPct } from "@/lib/utils";
import { riskLabel } from "@/lib/labels";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "—";
const dayCount = (iso: string, today: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);

export default async function CsmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("dashboard:internal");
  const loaded = await loadContext(await searchParams);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx } = loaded;
  const view = buildPortfolio(ctx.clients, ctx.rows, ctx.filters);
  const p = periodKey(ctx.filters.period);
  const today = new Date().toISOString().slice(0, 10);

  const assigned = view.csmBooks.filter((b) => b.csmEmail !== "");
  const anyCommercial = ctx.clients.some((c) => c.commercial);

  const header = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">CSM Portfolio</h1>
      <p className="text-sm text-slate-500">Book of business and account performance by CSM · {periodLabel(ctx.filters.period)}</p>
    </div>
  );

  // Until Salesforce data is loaded there is no CSM to group by, so show where it comes from instead of one anonymous book.
  if (assigned.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <Card className="border-dashed">
          <EmptyState title="No CSM data loaded yet">
            CSM names, renewal dates and licences come from the Salesforce account data.
            {can(user.role, "settings:manage") ? " Download the template and import it from Settings." : " An administrator can import it from Settings."}
          </EmptyState>
          {can(user.role, "settings:manage") && <p className="pb-6 text-center text-xs"><Link href="/settings" className="underline">Open Settings</Link></p>}
        </Card>
      </div>
    );
  }

  const csmOf = new Map(ctx.clients.map((c) => [c.id, c.csmName || "Unassigned"]));
  const renewals: TableRow[] = [...view.clients.map((c) => ({ c: c.client, health: c.current.healthScore, risk: c.risk })), ...view.noDataClients.map((c) => ({ c, health: null, risk: "unknown" as const }))]
    .filter((x) => x.c.commercial?.renewalDate && x.c.commercial.renewalDate >= today)
    .sort((a, b) => a.c.commercial!.renewalDate!.localeCompare(b.c.commercial!.renewalDate!))
    .map((x) => {
      const date = x.c.commercial!.renewalDate!;
      const days = dayCount(date, today);
      return {
        id: x.c.id, href: `/clients/${x.c.id}?period=${p}`,
        cells: {
          account: { v: x.c.name }, csm: { v: csmOf.get(x.c.id) ?? "Unassigned" },
          renewal: { v: date, node: <span className="tabular-nums">{date} <span className="text-xs text-slate-500">({days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`})</span></span> },
          health: { v: x.health, node: x.health?.toFixed(0) ?? "—" },
          risk: { v: riskLabel(x.risk), node: <RiskBadge risk={x.risk} /> },
        },
      };
    });

  const chart = [
    { metric: "Participation", ...Object.fromEntries(view.csmBooks.map((b) => [b.csmName, b.current.participationRate])) },
    { metric: "Knowledge", ...Object.fromEntries(view.csmBooks.map((b) => [b.csmName, b.current.avgKnowledge])) },
  ];

  return (
    <div className="space-y-6">
      {header}

      <section aria-label="CSM books of business" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {view.csmBooks.map((b) => (
          <Card key={b.csmEmail || "unassigned"} className="border-t-4 border-t-brand p-5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand-ink">{initials(b.csmName)}</span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{b.csmName}</p>
                <p className="text-xs text-slate-500">{b.clients} account{b.clients === 1 ? "" : "s"} · {fmtNumber(b.current.registeredUsers)} users</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {([["Avg participation", fmtPct(b.current.participationRate)], ["Avg knowledge", fmtPct(b.current.avgKnowledge)], ["Healthy", String(b.healthy)], ["At risk", String(b.atRisk)]] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-brand/10 px-3 py-2">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${k === "At risk" && b.atRisk > 0 ? "text-critical" : k === "Healthy" ? "text-brand-ink" : ""}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="CSM Performance" subtitle={`Average participation and knowledge across each CSM's accounts, ${periodLabel(ctx.filters.period)}`} />
          <div className="p-4"><CompareBars xKey="metric" data={chart} series={view.csmBooks.map((b) => ({ key: b.csmName, label: b.csmName }))} /></div>
        </Card>
        <Card>
          <CardHeader title="Upcoming Renewals" subtitle="Soonest first, from the Salesforce renewal date" badge={!anyCommercial ? <Badge tone="warn">Awaiting Salesforce data</Badge> : undefined} />
          {renewals.length === 0 ? (
            <EmptyState title={anyCommercial ? "No upcoming renewals" : "No renewal dates yet"}>
              {anyCommercial ? "No client has a renewal date from today onward." : "Add renewal_date to the Salesforce CSV in Settings and they will appear here."}
            </EmptyState>
          ) : (
            <DataTable searchable={false} canExport={can(user.role, "export:csv")} exportName={`renewals-${p}`}
              columns={[{ key: "account", header: "Account" }, { key: "csm", header: "CSM" }, { key: "renewal", header: "Renewal" }, { key: "health", header: "Health", align: "right" as const }, { key: "risk", header: "Risk" }]}
              rows={renewals} />
          )}
        </Card>
      </div>
    </div>
  );
}
