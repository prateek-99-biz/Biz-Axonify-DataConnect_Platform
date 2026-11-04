import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { loadContext, type SearchParams } from "@/server/services/context";
import { buildPortfolio } from "@/server/services/portfolio";
import { buildRenewals, renewalValueByCurrency } from "@/server/services/accounts";
import { sampleCount } from "@/server/services/salesforce-accounts";
import { periodKey } from "@/server/metrics/period";
import { Badge, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { KpiStrip } from "@/components/ui/kpi";
import { RiskBadge } from "@/components/ui/risk-badge";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { RenewalTimeline } from "@/components/internal/renewal-timeline";
import { SampleNotice } from "@/components/internal/sample-notice";
import { cn, fmtNumber, fmtHealth } from "@/lib/utils";
import { riskLabel } from "@/lib/labels";

const WINDOWS = [
  { key: "30", label: "30 Days", days: 30 }, { key: "60", label: "60 Days", days: 60 }, { key: "90", label: "90 Days", days: 90 },
  { key: "180", label: "6 Months", days: 180 }, { key: "365", label: "12 Months", days: 365 }, { key: "all", label: "All", days: null },
] as const;

const money = (currency: string, v: number) => `${currency} ${fmtNumber(Math.round(v))}`;

export default async function RenewalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("dashboard:internal");
  const sp = await searchParams;
  const loaded = await loadContext(sp);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx } = loaded;
  const period = periodKey(ctx.filters.period);
  const isAdmin = can(user.role, "settings:manage");
  const sample = await sampleCount();
  const today = new Date().toISOString().slice(0, 10);

  const wanted = Array.isArray(sp.window) ? sp.window[0] : sp.window;
  const win = WINDOWS.find((w) => w.key === wanted) ?? WINDOWS[2];

  const view = buildPortfolio(ctx.clients, ctx.rows, { ...ctx.filters, client: null, industry: null });
  const everything = buildRenewals(ctx.clients, view.clients, today, null);
  const rows = buildRenewals(ctx.clients, view.clients, today, win.days);
  const struggling = rows.filter((r) => r.risk === "critical" || r.risk === "at_risk");

  const header = (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Renewals<Badge tone="biz" className="ml-3 align-middle">Internal Only</Badge></h1>
      <p className="mt-1 text-sm text-slate-500">Upcoming contract renewals, with how healthy each account is</p>
    </div>
  );

  if (everything.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <SampleNotice count={sample} canRemove={isAdmin} />
        <Card className="border-dashed">
          <EmptyState title="No renewal dates yet">Renewal dates come from the Salesforce file. Add renewal_date for each client{isAdmin ? ", or load sample data to see the page, from Settings" : ""}.</EmptyState>
          {isAdmin && <p className="pb-6 text-center text-xs"><Link href="/settings" className="underline">Open Settings</Link></p>}
        </Card>
      </div>
    );
  }

  const tableRows: TableRow[] = rows.map((r) => ({
    id: r.clientId, href: `/clients/${r.clientId}?period=${period}&tab=commercial`,
    cells: {
      account: { v: r.name }, csm: { v: r.csm },
      renewal: { v: r.date, node: <span className="whitespace-nowrap tabular-nums">{r.date} <span className="text-xs text-slate-500">(in {r.days} day{r.days === 1 ? "" : "s"})</span></span> },
      value: { v: r.value, node: r.value == null ? "—" : <span className="whitespace-nowrap">{money(r.currency, r.value)}</span> },
      licences: { v: r.licenses, node: r.licenses == null ? "—" : fmtNumber(r.licenses) },
      health: { v: r.health, node: fmtHealth(r.health) },
      risk: { v: riskLabel(r.risk), node: <RiskBadge risk={r.risk} /> },
    },
  }));

  const totals = renewalValueByCurrency(rows);
  const atRiskTotals = renewalValueByCurrency(struggling);

  return (
    <div className="space-y-6">
      {header}
      <SampleNotice count={sample} canRemove={isAdmin} />

      <nav aria-label="Renewal window" className="glass inline-flex max-w-full gap-1 overflow-x-auto !rounded-full p-1 [scrollbar-width:none]">
        {WINDOWS.map((w) => (
          <Link key={w.key} href={`/renewals?window=${w.key}&period=${period}`} aria-current={w.key === win.key ? "page" : undefined}
            className={cn("whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-all", w.key === win.key ? "bg-brand font-semibold text-navy" : "text-slate-600 hover:bg-slate-100 hover:text-ink")}>{w.label}</Link>
        ))}
      </nav>

      <KpiStrip items={[
        { label: win.days == null ? "Upcoming Renewals" : `Renewing In ${win.label}`, value: String(rows.length) },
        { label: "Value Renewing", value: totals.length === 0 ? "—" : totals.map((t) => money(t.currency, t.total)).join(" · ") },
        { label: "At Risk Or Critical", value: String(struggling.length) },
        { label: "Their Value", value: atRiskTotals.length === 0 ? "—" : atRiskTotals.map((t) => money(t.currency, t.total)).join(" · ") },
      ]} />

      <Card>
        <CardHeader title="Renewal Timeline" subtitle="Next twelve months, every account, coloured by health" />
        <div className="px-5 py-4"><RenewalTimeline today={today} items={everything.map((r) => ({ id: r.clientId, name: r.name, days: r.days, risk: r.risk }))} /></div>
      </Card>

      <Card>
        <CardHeader title="Renewals" subtitle={win.days == null ? "Every upcoming renewal, soonest first" : `Renewing within ${win.label.toLowerCase()}, soonest first`} />
        {rows.length === 0 ? <EmptyState title={`No renewals in the next ${win.label.toLowerCase()}`}>Choose a longer window above.</EmptyState> : (
          <DataTable searchable={false} canExport={can(user.role, "export:csv")} exportName={`renewals-${win.key}`}
            columns={[
              { key: "account", header: "Account" }, { key: "csm", header: "CSM" }, { key: "renewal", header: "Renewal" },
              { key: "value", header: "Annual Value", align: "right" }, { key: "licences", header: "Licences", align: "right" },
              { key: "health", header: "Health", align: "right" }, { key: "risk", header: "Risk" },
            ]} rows={tableRows} />
        )}
      </Card>
    </div>
  );
}
