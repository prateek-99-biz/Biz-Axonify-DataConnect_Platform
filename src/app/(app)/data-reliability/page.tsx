import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { getAdapters } from "@/server/data";
import { loadContext, type SearchParams } from "@/server/services/context";
import { METRIC_DEFINITIONS, RISK_THRESHOLDS, HEALTH_WEIGHTS } from "@/server/metrics/definitions";
import { Badge, Card, CardHeader, SourceUnavailable } from "@/components/ui/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { db } from "@/server/db";
import { fmtNumber } from "@/lib/utils";

/** Provisional freshness SLA (hours). Not agreed with the data team. */
const STALE_HOURS = 72;

export default async function ReliabilityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("reliability:read");
  const loaded = await loadContext(await searchParams);
  const cov = await getAdapters().analytics.getSourceCoverage();
  const runs = await db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 });

  const clientName = new Map(loaded.ok ? loaded.ctx.clients.map((c) => [c.id, c.name]) : []);
  const now = Date.now();

  let coverageSection: React.ReactNode;
  if (cov.status !== "ok") coverageSection = <SourceUnavailable reason={cov.reason} />;
  else {
    const rows: TableRow[] = cov.data.map((r) => {
      const ageH = r.lastLoadedAt ? (now - Date.parse(r.lastLoadedAt)) / 3.6e6 : null;
      const status = r.lastLoadedAt == null ? "missing" : ageH! > STALE_HOURS ? "stale" : r.expectedRowCount && r.rowCount < r.expectedRowCount ? "incomplete" : "ok";
      const gap = r.expectedRowCount == null ? null : r.expectedRowCount - r.rowCount;
      return { id: `${r.clientId}-${r.source}`, href: `/clients/${r.clientId}`, cells: {
        client: { v: clientName.get(r.clientId) ?? r.clientId }, source: { v: r.source },
        loaded: { v: r.lastLoadedAt?.slice(0, 16).replace("T", " ") ?? null }, age: { v: ageH == null ? null : Math.round(ageH), node: ageH == null ? "—" : `${Math.round(ageH)}h` },
        rows: { v: r.rowCount, node: fmtNumber(r.rowCount) }, gap: { v: gap, node: gap == null ? "—" : gap > 0 ? fmtNumber(gap) : "0" },
        status: { v: status, node: <Badge tone={status === "ok" ? "good" : status === "stale" ? "warn" : "critical"}>{status}</Badge> },
      } };
    });
    const bad = rows.filter((r) => r.cells.status.v !== "ok").length;
    coverageSection = (
      <Card>
        <CardHeader title="Source coverage by client" subtitle={`${bad} of ${rows.length} client/source pairs need attention · stale = no load in ${STALE_HOURS}h (provisional SLA) · gap = expected − loaded rows`} />
        <DataTable canExport={can(user.role, "export:csv")} exportName="source-coverage"
          columns={[{ key: "client", header: "Client" }, { key: "source", header: "Source" }, { key: "loaded", header: "Last loaded (UTC)" }, { key: "age", header: "Age", align: "right" }, { key: "rows", header: "Rows", align: "right" }, { key: "gap", header: "Reconciliation gap", align: "right" }, { key: "status", header: "Status" }]}
          rows={rows} />
      </Card>
    );
  }

  const unmapped = loaded.ok ? loaded.ctx.clients.filter((c) => !c.salesforceAccountId || !c.axonifyTenantId) : [];

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-semibold">Data reliability</h1>
        <p className="text-sm text-slate-500">Source: {cov.source}{cov.status === "ok" ? ` · as of ${cov.asOf.slice(0, 16).replace("T", " ")} UTC` : ""}</p></div>
      {coverageSection}
      <Card>
        <CardHeader title="Sync history" subtitle="Daily scheduled job and manual refreshes. A failed sync keeps the previous data." />
        <ul className="divide-y divide-line text-sm">
          {runs.length === 0 && <li className="p-4 text-xs text-slate-500">No syncs have run yet.</li>}
          {runs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="flex items-center gap-2"><Badge tone={r.status === "ok" ? "good" : r.status === "failed" ? "critical" : "warn"}>{r.status}</Badge>{r.startedAt.toISOString().slice(0, 16).replace("T", " ")} UTC · {r.triggeredBy ?? "—"}</span>
              <span className="text-xs text-slate-500">{r.status === "ok" ? `${r.clientCount} clients · ${r.rowCount} rows` : r.message ?? ""}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Client key mapping" subtitle="Salesforce Account ID ↔ Axonify Tenant ID" />
        {unmapped.length === 0 ? <p className="p-4 text-sm text-slate-500">All clients have both identifiers.</p> : (
          <ul className="divide-y divide-line text-sm">
            {unmapped.map((c) => <li key={c.id} className="flex justify-between px-4 py-2"><span>{c.name}</span>
              <Badge tone="warn">{!c.salesforceAccountId ? "Missing Salesforce Account ID" : "Missing Axonify Tenant ID"}</Badge></li>)}
          </ul>)}
      </Card>
      <Card>
        <div id="definitions" />
        <CardHeader title="Metric definitions" subtitle="Shared by every page. All are provisional until approved by Biz Group." />
        <ul className="divide-y divide-line">
          {METRIC_DEFINITIONS.map((d) => (
            <li key={d.key} className="px-4 py-3 text-sm">
              <div className="flex items-center gap-2"><span className="font-medium">{d.name}</span><Badge tone={d.status === "approved" ? "good" : "warn"}>{d.status}</Badge></div>
              <p className="mt-0.5 text-xs text-slate-500">{d.description}</p>
              <code className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs">{d.formula}</code>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-3 text-xs text-slate-500">
          Health weights: engagement {HEALTH_WEIGHTS.engagement}, retention {HEALTH_WEIGHTS.retention}, adoption {HEALTH_WEIGHTS.adoption}. Risk bands: critical &lt; {RISK_THRESHOLDS.critical}, watch &lt; {RISK_THRESHOLDS.warning}. Quarters are calendar quarters.
        </p>
      </Card>
    </div>
  );
}
