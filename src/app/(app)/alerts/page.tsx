import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { loadContext, type SearchParams } from "@/server/services/context";
import { buildPortfolio, deriveAlerts } from "@/server/services/portfolio";
import { ackedAlertKeys } from "@/server/services/alert-acks";
import { buildWatchlist, type WatchAction } from "@/server/services/accounts";
import { sampleCount } from "@/server/services/salesforce-accounts";
import { periodKey, periodLabel } from "@/server/metrics/period";
import { Badge, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { KpiStrip } from "@/components/ui/kpi";
import { RiskBadge } from "@/components/ui/risk-badge";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { AckButton } from "@/components/internal/ack-button";
import { SampleNotice } from "@/components/internal/sample-notice";
import { cn, fmtPct } from "@/lib/utils";

const ACTION_TONE: Record<WatchAction, "critical" | "warn" | "neutral"> = { Escalate: "critical", Review: "warn", Monitor: "neutral" };
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

export default async function AlertsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("dashboard:internal");
  const loaded = await loadContext(await searchParams);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx } = loaded;
  const period = periodKey(ctx.filters.period);

  const view = buildPortfolio(ctx.clients, ctx.rows, { ...ctx.filters, client: null, industry: null });
  const acked = new Set(await ackedAlertKeys(user.id));
  const every = deriveAlerts(view, ctx.filters.period);
  const open = every.filter((a) => !acked.has(a.key));
  const watch = buildWatchlist(view.clients, ctx.rows, ctx.filters.period);
  const sample = await sampleCount();
  const csmOf = new Map(ctx.clients.map((c) => [c.id, c.csmName || "Unassigned"]));

  const rows: TableRow[] = watch.map((w) => ({
    id: w.clientId, href: `/clients/${w.clientId}?period=${period}`,
    cells: {
      account: { v: w.name }, csm: { v: w.csm },
      participation: { v: w.participation, node: fmtPct(w.participation) },
      change: { v: w.changePts, node: <span className="text-critical">{w.changePts == null ? "—" : `${signed(w.changePts)} pts`}</span> },
      knowledge: { v: w.knowledge, node: fmtPct(w.knowledge) },
      streak: { v: w.streak, node: `${w.streak} quarter${w.streak === 1 ? "" : "s"}` },
      action: { v: w.action, node: <Badge tone={ACTION_TONE[w.action]}>{w.action}</Badge> },
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alerts and Watchlist<Badge tone="biz" className="ml-3 align-middle">Internal Only</Badge></h1>
        <p className="mt-1 text-sm text-slate-500">What needs a conversation in {periodLabel(ctx.filters.period)}, and who to talk to about it</p>
      </div>

      <SampleNotice count={sample} canRemove={can(user.role, "settings:manage")} />

      <KpiStrip items={[
        { label: "Open Alerts", value: String(open.length) },
        { label: "Critical", value: String(open.filter((a) => a.severity === "critical").length) },
        { label: "On The Watchlist", value: String(watch.length) },
        { label: "Cleared By You", value: String(every.length - open.length) },
      ]} />

      <Card>
        <CardHeader title="Open Alerts" subtitle="Critical first. Acknowledging clears an alert for you; a new one is raised if the problem returns." />
        {open.length === 0 ? (
          <EmptyState title="No open alerts">Every account is out of the Critical band and none has an uncleared alert in {periodLabel(ctx.filters.period)}.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {open.map((a) => (
              <li key={a.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <span className="w-24 shrink-0"><Badge tone={a.severity === "critical" ? "critical" : "warn"}>{a.severity === "critical" ? "Critical" : "Warning"}</Badge></span>
                <span className="min-w-0 flex-1 basis-64">
                  <Link href={`/clients/${a.clientId}?period=${period}`} className="font-semibold hover:underline">{a.clientName}</Link>
                  <span className="text-xs text-slate-500"> · {csmOf.get(a.clientId)}</span>
                  <span className="block text-xs text-slate-600"><span className="font-medium text-ink">{a.title}.</span> {a.detail}</span>
                </span>
                <span className="flex items-center gap-3">
                  <Link href={`/clients/${a.clientId}?period=${period}&tab=activity`} className="text-xs underline">Add a task</Link>
                  <AckButton alertKey={a.key} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Engagement Watchlist" subtitle="Accounts whose participation fell 3 points or more against the previous quarter, worst first" />
        {watch.length === 0 ? (
          <EmptyState title="Nothing on the watchlist">No account lost 3 points of participation or more.</EmptyState>
        ) : (
          <DataTable searchable={false} canExport={can(user.role, "export:csv")} exportName={`watchlist-${period}`}
            columns={[
              { key: "account", header: "Account" }, { key: "csm", header: "CSM" },
              { key: "participation", header: "Participation", align: "right" }, { key: "change", header: "Change", align: "right" },
              { key: "knowledge", header: "Knowledge", align: "right" }, { key: "streak", header: "Declining For", align: "right" }, { key: "action", header: "Suggested Action" },
            ]} rows={rows} />
        )}
        <p className="border-t hairline px-5 py-3 text-xs text-slate-500">
          <span className={cn("font-medium text-ink")}>Escalate</span> for Critical accounts, <span className="font-medium text-ink">Review</span> for At Risk accounts or two quarters of decline, <span className="font-medium text-ink">Monitor</span> otherwise.
          {" "}Accounts in the Critical or At Risk bands are marked <RiskBadge risk="critical" /> or <RiskBadge risk="at_risk" /> on their client page.
        </p>
      </Card>
    </div>
  );
}
