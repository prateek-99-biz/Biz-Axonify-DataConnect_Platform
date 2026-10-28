import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SourceUnavailable, Card, CardHeader } from "@/components/ui/primitives";
import { KpiStrip, KpiTile, PageHeader, ScopeTag } from "@/components/dashboard/primitives";
import { SingleLine } from "@/components/dashboard/dash-charts";
import { QBR_PAGES } from "@/components/dashboard/pages";
import { House } from "lucide-react";
import { headline, monthAxisLabel, monthLabel } from "@/server/dashboard/calc";
import { carryQuery, loadQbr } from "@/server/dashboard/context";
import type { SearchParams } from "@/server/services/context";
import { fmtCompact, fmtPct } from "@/lib/utils";

export default async function QbrHome({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = await loadQbr(sp);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, range } = q.ctx;
  const h = headline(data, range);
  const qs = carryQuery(sp);

  const series = h.months.map((m) => ({
    month: monthAxisLabel(m.month, data.asOf), frequency: m.frequency, participation: m.activeUsers ? m.trainingUsers / m.activeUsers : null,
  }));

  return (
    <div className="space-y-6">
      <PageHeader icon={House} title="Axonify Data Connect" subtitle={`${data.clientName} \u00b7 ${monthLabel(range.from)} to ${monthLabel(range.to)}`} />

      <KpiStrip>
        <KpiTile label="Engagement Health" scope="month" scopeLabel="Month + snapshot" value={fmtPct(h.health, 0)} hint="50% participation + 50% knowledge" />
        <KpiTile label="Avg Frequency" scope="month" value={h.latest ? `${h.latest.frequency.toFixed(1)}x` : "\u2014"} hint="Sessions per active user, latest month" />
        <KpiTile label="Active Users" scope="month" value={fmtCompact(h.latest?.activeUsers)} hint="Latest month in range" />
        <KpiTile label="Avg Participation" scope="month" value={fmtPct(h.participation, 0)} hint="Training users ÷ active users" />
        <KpiTile label="Avg Knowledge" scope="snapshot" value={fmtPct(h.avgKnowledge, 0)} hint="Average current score across all topic levels (as in Axonify reports)" />
      </KpiStrip>

      <Card>
        <CardHeader title="Dashboard pages" subtitle="Jump into any area of the report" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {QBR_PAGES.slice(1).map((p) => (
            <Link key={p.href} href={`${p.href}${qs}`} className="group flex items-center gap-3 rounded-2xl border border-line/70 bg-white/40 p-3 transition-all hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-glass dark:bg-white/5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand-ink transition-colors group-hover:bg-gradient-to-br group-hover:from-brand group-hover:to-brand-accent group-hover:text-navy">
                <p.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{p.label}</span>
                <span className="block truncate text-xs text-slate-500">{p.blurb}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-brand-ink" aria-hidden />
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Avg Frequency by Month" badge={<ScopeTag scope="range" />} subtitle="Sessions per active user" />
          <div className="p-4"><SingleLine data={series} xKey="month" yKey="frequency" label="Avg frequency" format="decimal" /></div>
        </Card>
        <Card>
          <CardHeader title="Avg Participation by Month" badge={<ScopeTag scope="range" />} subtitle="Training users ÷ active users" />
          <div className="p-4"><SingleLine data={series} xKey="month" yKey="participation" label="Avg participation" format="pct" /></div>
        </Card>
      </div>
    </div>
  );
}
