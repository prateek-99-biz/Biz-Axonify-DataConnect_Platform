import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { getAdapters } from "@/server/data";
import { db } from "@/server/db";
import { loadContext, type SearchParams } from "@/server/services/context";
import { buildPortfolio } from "@/server/services/portfolio";
import { aggregate, contributingFactor, delta } from "@/server/metrics/calculations";
import { periodKey, periodLabel, previousPeriod, quartersIn, yearAgo } from "@/server/metrics/period";
import { Badge, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { KpiCard } from "@/components/ui/kpi";
import { RiskBadge } from "@/components/ui/risk-badge";
import { CompareBars, TrendChart } from "@/components/charts/charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { TeamTree } from "@/components/tables/team-tree";
import { NotesTasks } from "@/components/tables/notes-tasks";
import { cn, fmtNumber, fmtPct } from "@/lib/utils";
import { humanize, lifecycleLabel } from "@/lib/labels";

const TABS = [
  ["overview", "Overview"], ["teams", "Teams"], ["users", "Users"], ["engagement", "Engagement"], ["commercial", "Contract & Renewals"], ["activity", "Notes & Tasks"],
] as const;

export default async function ClientPage({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("clients:read");
  const { clientId } = await params;
  const sp = await searchParams;
  const loaded = await loadContext(sp);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx } = loaded;
  const client = ctx.clients.find((c) => c.id === clientId);
  if (!client) notFound();

  const f = ctx.filters;
  const tab = TABS.find(([k]) => k === (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab))?.[0] ?? "overview";
  const rows = ctx.rows.filter((r) => r.clientId === clientId);
  const cur = quartersIn(f.period);
  const prev = quartersIn(previousPeriod(f.period));
  const m = aggregate(rows, cur);
  const mPrev = aggregate(rows, prev);
  const mYa = aggregate(rows, quartersIn(yearAgo(f.period)));
  const hasData = rows.some((r) => cur.includes(r.period));
  const snapshotQuarter = f.period.quarter ? periodKey(f.period) : cur.filter((q) => rows.some((r) => r.period === q)).at(-1);
  const base = `/clients/${clientId}`;
  const qs = (t: string) => `${base}?${new URLSearchParams({ period: periodKey(f.period), tab: t }).toString()}`;

  // Peer benchmark: same industry (excluding this client) and whole portfolio.
  const peerView = buildPortfolio(ctx.clients.filter((c) => c.id !== clientId && c.industry === client.industry), ctx.rows, { client: null, industry: null, period: f.period });
  const portfolioView = buildPortfolio(ctx.clients, ctx.rows, { client: null, industry: null, period: f.period });
  const peerMetrics = peerView.kpis.current;

  const { analytics, crm } = getAdapters();
  const trend = rows.sort((a, b) => a.period.localeCompare(b.period)).map((r) => {
    const x = aggregate([r], [r.period]);
    return { period: r.period, engagementRate: x.engagementRate, participationRate: x.participationRate, avgKnowledge: x.avgKnowledge, retentionRate: x.retentionRate, featureAdoption: x.featureAdoption, activeUsers: r.activeUsers, sessions: r.sessions };
  });

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge>{client.industry}</Badge><span>CSM: {client.csmName}</span>
          <span>Axonify tenant: {client.axonifyTenantId ?? "Not mapped"}</span>
          <span>Salesforce account: {client.salesforceAccountId ?? <span className="font-medium text-amber-700 dark:text-amber-300">Not mapped</span>}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm"><span className="text-slate-500">{periodLabel(f.period)}</span><RiskBadge risk={hasData ? m.risk : "unknown"} /></div>
    </div>
  );

  const tabs = (
    <nav aria-label="Client sections" className="glass inline-flex max-w-full gap-1 overflow-x-auto !rounded-full p-1 [scrollbar-width:none]">
      {TABS.map(([k, label]) => (
        <Link key={k} href={qs(k)} aria-current={tab === k ? "page" : undefined}
          className={cn("whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-all", tab === k ? "bg-brand font-semibold text-navy shadow-[0_6px_18px_-8px_rgb(var(--brand)/0.9)]" : "text-slate-600 hover:bg-slate-100 hover:text-ink")}>{label}</Link>
      ))}
    </nav>
  );

  let body: React.ReactNode;

  if (tab === "commercial") {
    const sfId = client.salesforceAccountId;
    const res = sfId && can(user.role, "commercial:read") ? await crm.getAccount(sfId) : null;
    body = !can(user.role, "commercial:read") ? <SourceUnavailable reason="Your role does not include commercial information." />
      : !sfId ? <SourceUnavailable reason="This client has no Salesforce Account ID mapped, so contract data cannot be looked up. An Admin can add the mapping." />
      : res?.status === "ok" ? (
        <Card><CardHeader title="Contract" /><dl className="grid gap-3 p-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-slate-500">Start</dt><dd>{res.data.contractStart ?? "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">End</dt><dd>{res.data.contractEnd ?? "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">ARR</dt><dd>{res.data.arr == null ? "—" : fmtNumber(res.data.arr)}</dd></div></dl></Card>
      ) : <SourceUnavailable reason={res && res.status === "unavailable" ? res.reason : "Unavailable"} />;
  } else if (!hasData && tab !== "activity") {
    body = <EmptyState title={`No Axonify data for ${periodLabel(f.period)}`}>This client has no records in the selected period. Choose a period the client was live in.</EmptyState>;
  } else if (tab === "overview") {
    const factors = contributingFactor(m, mPrev);
    body = (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Registered Users" unit="pct" value={fmtNumber(m.registeredUsers)} vsPrev={delta(m.registeredUsers, mPrev.registeredUsers)} vsYear={delta(m.registeredUsers, mYa.registeredUsers)} />
          <KpiCard label="Participation" value={fmtPct(m.participationRate)} vsPrev={delta(m.participationRate, mPrev.participationRate)} vsYear={delta(m.participationRate, mYa.participationRate)} />
          <KpiCard label="Knowledge" value={fmtPct(m.avgKnowledge)} vsPrev={delta(m.avgKnowledge, mPrev.avgKnowledge)} vsYear={delta(m.avgKnowledge, mYa.avgKnowledge)} />
          <KpiCard label="Health Score" unit="abs" value={m.healthScore?.toFixed(0) ?? "—"} vsPrev={delta(m.healthScore, mPrev.healthScore)} vsYear={delta(m.healthScore, mYa.healthScore)} />
          <KpiCard label="Engagement" value={fmtPct(m.engagementRate)} vsPrev={delta(m.engagementRate, mPrev.engagementRate)} vsYear={delta(m.engagementRate, mYa.engagementRate)} />
          <KpiCard label="Retention" value={fmtPct(m.retentionRate)} vsPrev={delta(m.retentionRate, mPrev.retentionRate)} vsYear={delta(m.retentionRate, mYa.retentionRate)} />
          <KpiCard label="Feature Adoption" value={fmtPct(m.featureAdoption)} vsPrev={delta(m.featureAdoption, mPrev.featureAdoption)} vsYear={delta(m.featureAdoption, mYa.featureAdoption)} />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2"><CardHeader title="Historical Performance" subtitle="All available quarters" />
            <div className="p-4"><TrendChart data={trend} series={[{ key: "participationRate", label: "Participation" }, { key: "avgKnowledge", label: "Knowledge" }, { key: "engagementRate", label: "Engagement" }]} /></div></Card>
          <Card><CardHeader title="What Changed" subtitle={`Weighted contribution to health score vs ${periodLabel(previousPeriod(f.period))}`} />
            <ul className="divide-y divide-line text-sm">
              {mPrev.healthScore == null ? <li className="p-4 text-xs text-slate-500">No previous-period data to compare.</li> :
                factors.map((x) => <li key={x.key} className="flex justify-between px-4 py-3"><span>{x.label}</span><span className={cn("tabular-nums", x.points < -0.05 ? "text-critical" : x.points > 0.05 ? "text-brand-ink" : "text-slate-500")}>{x.points > 0 ? "+" : ""}{x.points.toFixed(1)} pts</span></li>)}
            </ul></Card>
        </div>
        <Card><CardHeader title="Peer Benchmark" subtitle={`This client vs ${client.industry} peers (${peerView.clients.length}) and the whole portfolio (${portfolioView.clients.length}), ${periodLabel(f.period)}`} />
          <div className="p-4"><CompareBars xKey="metric" series={[{ key: "client", label: client.name }, { key: "peers", label: `${client.industry} peers` }, { key: "portfolio", label: "Portfolio" }]}
            data={[
              { metric: "Participation", client: m.participationRate, peers: peerMetrics.participationRate, portfolio: portfolioView.kpis.current.participationRate },
              { metric: "Knowledge", client: m.avgKnowledge, peers: peerMetrics.avgKnowledge, portfolio: portfolioView.kpis.current.avgKnowledge },
              { metric: "Engagement", client: m.engagementRate, peers: peerMetrics.engagementRate, portfolio: portfolioView.kpis.current.engagementRate },
              { metric: "Retention", client: m.retentionRate, peers: peerMetrics.retentionRate, portfolio: portfolioView.kpis.current.retentionRate },
              { metric: "Adoption", client: m.featureAdoption, peers: peerMetrics.featureAdoption, portfolio: portfolioView.kpis.current.featureAdoption },
            ]} /></div></Card>
      </div>
    );
  } else if (tab === "teams" || tab === "users" || tab === "engagement") {
    if (!snapshotQuarter) {
      body = <EmptyState title="No quarter selected" />;
    } else {
      const teams = await analytics.getTeamTree(clientId, snapshotQuarter);
      if (teams.status !== "ok") body = <SourceUnavailable reason={teams.reason} />;
      else if (tab === "teams") {
        body = <Card><CardHeader title="Team Hierarchy" subtitle={`${periodLabel({ year: Number(snapshotQuarter.slice(0, 4)), quarter: Number(snapshotQuarter[6]) as 1 })} snapshot · expand regions to see teams`} />
          {teams.data.length === 0 ? <EmptyState title="No team hierarchy available" /> : <TeamTree nodes={teams.data} />}</Card>;
      } else if (tab === "users") {
        const users = await analytics.getUsers(clientId, snapshotQuarter);
        if (users.status !== "ok") body = <SourceUnavailable reason={users.reason} />;
        else {
          const names = new Map(teams.data.map((t) => [t.id, t.name]));
          const counts = users.data.reduce<Record<string, number>>((a, u) => ({ ...a, [u.lifecycle]: (a[u.lifecycle] ?? 0) + 1 }), {});
          const tr: TableRow[] = users.data.map((u) => ({ id: u.id, cells: {
            name: { v: u.displayName }, team: { v: names.get(u.teamId) ?? u.teamId }, lifecycle: { v: lifecycleLabel(u.lifecycle), node: <Badge tone={u.lifecycle === "active" || u.lifecycle === "new" ? "good" : u.lifecycle === "at_risk" ? "warn" : "neutral"}>{lifecycleLabel(u.lifecycle)}</Badge> },
            registered: { v: u.registeredAt.slice(0, 10) }, last: { v: u.lastActiveAt?.slice(0, 10) ?? null }, sessions: { v: u.sessionsInPeriod },
          } }));
          body = (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">{Object.entries(counts).map(([k, v]) => <Badge key={k} tone="neutral">{humanize(k)}: {v}</Badge>)}</div>
              <Card><CardHeader title="Users" subtitle={`${users.source === "mock" ? "Mock adapter returns a sample of up to 25 users per team. " : ""}Lifecycle bands are provisional.`} />
                <DataTable canExport={can(user.role, "export:csv")} exportName={`${client.name}-users-${snapshotQuarter}`}
                  columns={[{ key: "name", header: "User" }, { key: "team", header: "Team" }, { key: "lifecycle", header: "Lifecycle" }, { key: "registered", header: "Registered" }, { key: "last", header: "Last Active" }, { key: "sessions", header: "Sessions", align: "right" }]} rows={tr} /></Card>
            </div>
          );
        }
      } else {
        const leaves = teams.data.filter((n) => !teams.data.some((x) => x.parentId === n.id));
        body = (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader title="Active Users and Sessions" subtitle="Quarterly" /><div className="p-4"><TrendChart format="number" data={trend} series={[{ key: "activeUsers", label: "Active Users" }, { key: "sessions", label: "Sessions" }]} /></div></Card>
            <Card><CardHeader title="Engagement by Team" subtitle={`Active ÷ registered, ${snapshotQuarter}`} /><div className="p-4"><CompareBars xKey="team" data={leaves.map((l) => ({ team: l.name, engagement: l.registeredUsers ? l.activeUsers / l.registeredUsers : null }))} series={[{ key: "engagement", label: "Engagement" }]} /></div></Card>
          </div>
        );
      }
    }
  } else {
    const [notes, tasks] = await Promise.all([
      db.note.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 50, include: { author: true } }),
      db.task.findMany({ where: { clientId }, orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 50, include: { owner: true } }),
    ]);
    body = (
      <div className="space-y-6">
        <NotesTasks clientId={clientId} canWrite={can(user.role, "clients:tasks:write")}
          notes={notes.map((n) => ({ id: n.id, body: n.body, author: n.author.name ?? n.author.email, createdAt: n.createdAt.toISOString() }))}
          tasks={tasks.map((t) => ({ id: t.id, title: t.title, detail: t.detail, priority: t.priority, status: t.status, dueDate: t.dueDate?.toISOString() ?? null, owner: t.owner?.name ?? t.owner?.email ?? null }))} />
      </div>
    );
  }

  return <div className="space-y-4">{header}{tabs}{body}</div>;
}
