import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { loadContext, type SearchParams } from "@/server/services/context";
import { aggregate } from "@/server/metrics/calculations";
import { periodKey, periodLabel, quartersIn, quarterRange } from "@/server/metrics/period";
import { Button, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { CompareBars, TrendChart } from "@/components/charts/charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { fmtNumber, fmtPct } from "@/lib/utils";

export default async function ComparePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("clients:read");
  const sp = await searchParams;
  const loaded = await loadContext(sp);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx } = loaded;
  const raw = sp.ids;
  const picked = (Array.isArray(raw) ? raw : raw ? raw.split(",") : []).filter((id) => ctx.clients.some((c) => c.id === id)).slice(0, 5);
  const compareQ = (Array.isArray(sp.vs) ? sp.vs[0] : sp.vs) ?? "";
  const periods = [periodKey(ctx.filters.period), ...(ctx.availablePeriods.includes(compareQ) && compareQ !== periodKey(ctx.filters.period) ? [compareQ] : [])];

  const selected = picked.map((id) => ctx.clients.find((c) => c.id === id)!);
  const rowsFor = (id: string) => ctx.rows.filter((r) => r.clientId === id);

  const tableRows: TableRow[] = selected.flatMap((c) => periods.map((p) => {
    const m = aggregate(rowsFor(c.id), quartersIn({ year: Number(p.slice(0, 4)), quarter: p.length > 4 ? (Number(p[6]) as 1) : null }));
    const none = m.registeredUsers === 0;
    return { id: `${c.id}-${p}`, href: `/clients/${c.id}?period=${p}`, cells: {
      client: { v: c.name }, period: { v: p },
      users: { v: none ? null : m.registeredUsers, node: none ? "—" : fmtNumber(m.registeredUsers) },
      participation: { v: m.participationRate, node: fmtPct(m.participationRate) }, knowledge: { v: m.avgKnowledge, node: fmtPct(m.avgKnowledge) },
      engagement: { v: m.engagementRate, node: fmtPct(m.engagementRate) }, health: { v: m.healthScore, node: m.healthScore?.toFixed(0) ?? "—" },
    } };
  }));

  const quarters = quarterRange({ year: Number(ctx.availablePeriods[0].slice(0, 4)), quarter: 1 }, { year: Number(ctx.availablePeriods.at(-1)!.slice(0, 4)), quarter: Number(ctx.availablePeriods.at(-1)![6]) as 1 });
  const trend = quarters.map((q) => {
    const point: Record<string, number | string | null> = { period: q };
    selected.forEach((c) => { point[c.id] = aggregate(rowsFor(c.id), [q]).participationRate; });
    return point;
  });
  const bars = selected.map((c) => {
    const o: Record<string, number | string | null> = { client: c.name };
    periods.forEach((p) => { o[p] = aggregate(rowsFor(c.id), quartersIn({ year: Number(p.slice(0, 4)), quarter: p.length > 4 ? (Number(p[6]) as 1) : null })).healthScore; });
    return o;
  });

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">Compare Clients and Quarters</h1><p className="text-sm text-slate-500">Pick up to 5 clients; add a second quarter to compare periods. Primary period follows the global filter ({periodLabel(ctx.filters.period)}).</p></div>
      <Card>
        <form method="get" className="space-y-3 p-4">
          <input type="hidden" name="period" value={periodKey(ctx.filters.period)} />
          <fieldset><legend className="mb-1 text-xs font-medium text-slate-500">Clients</legend>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
              {ctx.clients.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="ids" value={c.id} defaultChecked={picked.includes(c.id)} />{c.name}</label>)}
            </div></fieldset>
          <label className="flex items-center gap-2 text-sm">Compare against quarter
            <select name="vs" defaultValue={compareQ} className="field h-9 px-2.5 text-sm">
              <option value="">None</option>{ctx.availablePeriods.map((p) => <option key={p}>{p}</option>)}
            </select></label>
          <Button variant="primary">Compare</Button>
        </form>
      </Card>
      {selected.length < 2 ? <Card><EmptyState title="Select at least two clients">Tick two or more clients above and press Compare.</EmptyState></Card> : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader title="Participation over Time" /><div className="p-4"><TrendChart data={trend} series={selected.map((c) => ({ key: c.id, label: c.name }))} /></div></Card>
            <Card><CardHeader title="Health Score" subtitle={periods.join(" vs ")} /><div className="p-4"><CompareBars xKey="client" format="number" data={bars} series={periods.map((p) => ({ key: p, label: p }))} /></div></Card>
          </div>
          <Card><CardHeader title="Side by Side" />
            <DataTable searchable={false} canExport={can(user.role, "export:csv")} exportName="client-comparison"
              columns={[{ key: "client", header: "Client" }, { key: "period", header: "Period" }, { key: "users", header: "Users", align: "right" }, { key: "participation", header: "Participation", align: "right" }, { key: "knowledge", header: "Knowledge", align: "right" }, { key: "engagement", header: "Engagement", align: "right" }, { key: "health", header: "Health", align: "right" }]}
              rows={tableRows} /></Card>
        </>
      )}
    </div>
  );
}
