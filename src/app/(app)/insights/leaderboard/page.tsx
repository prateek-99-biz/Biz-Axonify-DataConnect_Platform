import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import type { SearchParams } from "@/server/services/context";
import { loadInsights } from "@/server/services/insights-context";
import { LEADER_METRICS, MIN_RANKED_USERS, podiumCounts, rankBy, type LeaderMetric } from "@/server/services/insights";
import { FEATURES } from "@/server/metrics/features";
import { periodKey, periodLabel, yearAgo } from "@/server/metrics/period";
import { Badge, Button, Card, CardHeader, EmptyState, Select, SourceUnavailable } from "@/components/ui/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { PeriodNotice } from "@/components/internal/period-notice";
import { fmtLeader, InsightsHeader, Medal, MeterRow, PlainSummary, UsageNotice, type BarTone } from "@/components/insights/ui";
import { CountingBar } from "@/components/insights/basis";
import { cn, fmtNumber } from "@/lib/utils";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const GROUP_TONE: Record<LeaderMetric["group"], BarTone> = { AI: "purple", Engagement: "good", Learning: "blue", Growth: "orange", Features: "good" };
const GROUP_BADGE: Record<LeaderMetric["group"], "biz" | "good" | "neutral" | "warn"> = { AI: "biz", Engagement: "good", Learning: "neutral", Growth: "warn", Features: "good" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("dashboard:internal");
  const sp = await searchParams;
  const loaded = await loadInsights(sp);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx, insights, usageReason } = loaded;
  const period = periodKey(ctx.filters.period);
  const label = periodLabel(ctx.filters.period);
  const yaLabel = periodLabel(yearAgo(ctx.filters.period));
  const isYear = ctx.filters.period.quarter == null;

  const candidates = insights.clients.filter((c) => c.view || c.hasUsage);
  if (candidates.length < 2) return <EmptyState title="A leaderboard needs at least two clients">Choose a period in which two or more clients have data.</EmptyState>;

  // Measures with at least one ranked client; the Max ones drop out until the monthly data is synced.
  const boards = LEADER_METRICS.map((m) => ({ m, ranked: rankBy(candidates, m) })).filter((b) => b.ranked.length > 0);
  const missing = LEADER_METRICS.filter((m) => !boards.some((b) => b.m === m));
  const chosen = boards.find((b) => b.m.key === one(sp.by)) ?? boards[0];
  const leader = (key: string) => boards.find((b) => b.m.key === key)?.ranked[0];
  const overall = podiumCounts(candidates, boards.map((b) => b.m));

  const line = (key: string, text: (name: string, value: string) => string) => {
    const l = leader(key);
    const m = boards.find((b) => b.m.key === key)?.m;
    return l && m ? text(l.insight.client.name, fmtLeader(l.value, m.format)) : "";
  };
  const summary = [
    line("maxPer100", (n, v) => `Most AI use: ${n}, with ${v} Max questions per 100 active users a month.`),
    line("maxAdoption", (n, v) => `Widest Max rollout: ${n}, where ${v} of active users ask Max in an average month.`),
    line("participation", (n, v) => `Best participation: ${n} at ${v}.`) + " " + line("engagement", (n, v) => `Highest engagement: ${n} at ${v}.`),
    line("userGrowth", (n, v) => `Biggest growth: ${n}, with people logging in ${v} against the same months in ${yaLabel}.`),
    line("commsReach", (n, v) => `Most communications use: ${n}, where ${v} of active users open broadcasts.`),
    overall[0] ? `Overall, ${overall[0].insight.client.name} leads ${overall[0].golds} of the ${boards.length} rankings and is in the top three of ${overall[0].podiums}.` : "",
  ].map((s) => s.trim());

  // Bars for the chosen measure: shares on their own 0-100% scale, everything else against the leader.
  const isShare = chosen.m.format === "pct";
  const top = Math.max(...chosen.ranked.map((r) => Math.abs(r.value)), 0);
  // A fall is drawn too (in red, by its size), so a client that shrank does not look like it has no value.
  const scale = (v: number) => (isShare ? v : top > 0 ? Math.abs(v) / top : 0);
  const excluded = chosen.m.needsSize ? candidates.filter((c) => !c.ranked && chosen.m.value(c) != null) : [];

  const tableRows: TableRow[] = candidates.map((c) => ({
    id: c.client.id, href: `/insights/benchmarks?period=${period}&focus=${c.client.id}`,
    cells: Object.fromEntries([
      ["client", { v: c.client.name }],
      ["users", { v: c.usage.avgActiveUsers ?? c.health?.activeUsers ?? null, node: fmtNumber(c.usage.avgActiveUsers ?? c.health?.activeUsers ?? null) }],
      ...boards.map((b) => {
        const v = b.m.value(c);
        const r = b.ranked.find((x) => x.insight === c)?.rank;
        return [b.m.key, { v, node: <span className={cn(r === 1 && "font-semibold text-brand-ink")}>{fmtLeader(v, b.m.format)}{r != null && r <= 3 ? <span className="ml-1 text-[10px] text-slate-500">#{r}</span> : null}</span> }];
      }),
    ]),
  }));

  return (
    <div className="space-y-6">
      <InsightsHeader title="Client Leaderboard"
        subtitle={`Every client compared in ${label}: who uses AI and Max the most, who has the best participation and engagement, who grew the most, and who uses communications the most.${isYear ? "" : " Pick a full year in the period filter to rank the whole year."}`} />
      <PeriodNotice label={label} progress={ctx.progress} asOf={ctx.asOf} />
      <UsageNotice reason={usageReason} />
      <CountingBar basis={loaded.basis} available={loaded.programsAvailable} gaps={loaded.gaps} names={Object.fromEntries(ctx.clients.map((c) => [c.id, c.name]))} />
      <PlainSummary title="Who Leads" points={summary} />
      {missing.length > 0 && (
        <p className="text-xs text-slate-500">
          Not shown for {label}: {missing.map((m) => m.label).join(", ")}. {missing.some((m) => m.key === "knowledge" || m.key === "health")
            ? "Axonify keeps only each learner's current knowledge score, so knowledge (and the Health Score built on it) exists from the quarter this platform started recording it. Pick the current quarter or year to see them."
            : "No client has a value for them in this period."}
        </p>
      )}

      <section aria-label="Category winners" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {boards.map(({ m, ranked }) => (
          <Card key={m.key} className="flex flex-col p-5">
            {/* Wraps so a long title ("Most Communications Use" in a narrow card) moves the tag down rather than out of the card. */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{m.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{m.question}</p>
              </div>
              <Badge tone={GROUP_BADGE[m.group]}>{m.group === "AI" ? "AI" : m.group}</Badge>
            </div>
            <ol className="mt-3 space-y-2">
              {ranked.slice(0, 3).map((r) => (
                <li key={r.insight.client.id} className="flex items-center gap-2.5 text-sm">
                  <Medal rank={r.rank} />
                  <Link href={`/insights/benchmarks?period=${period}&focus=${r.insight.client.id}`} className={cn("min-w-0 flex-1 truncate hover:underline", r.rank === 1 && "font-semibold")}>{r.insight.client.name}</Link>
                  <span className="font-semibold tabular-nums">{fmtLeader(r.value, m.format)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-auto pt-3 text-[11px] text-slate-500" title={m.how}>
              {m.how} <Link href={`/insights/leaderboard?period=${period}&by=${m.key}#ranking`} className="underline">All {ranked.length}</Link>
            </p>
          </Card>
        ))}
      </section>

      <Card id="ranking">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b hairline px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold">Rank Every Client</h3>
            <p className="mt-0.5 text-xs text-slate-500">{chosen.m.question} {chosen.m.how}</p>
          </div>
          <form method="get" action="/insights/leaderboard#ranking" className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <input type="hidden" name="period" value={period} />
            <label className="flex items-center gap-2">Rank by
              <Select name="by" defaultValue={chosen.m.key} aria-label="Rank clients by">
                {boards.map((b) => <option key={b.m.key} value={b.m.key}>{b.m.label}</option>)}
              </Select>
            </label>
            <Button size="sm">Show</Button>
          </form>
        </div>
        <div className="px-5 py-3">
          {chosen.ranked.map((r) => (
            <div key={r.insight.client.id} className="flex items-center gap-3">
              <Medal rank={r.rank} />
              <div className="min-w-0 flex-1">
                <MeterRow label={r.insight.client.name} href={`/insights/benchmarks?period=${period}&focus=${r.insight.client.id}`} value={scale(r.value)} display={fmtLeader(r.value, chosen.m.format)} tone={r.value < 0 ? "critical" : GROUP_TONE[chosen.m.group]} />
              </div>
            </div>
          ))}
        </div>
        {(excluded.length > 0 || chosen.ranked.length < candidates.length) && (
          <p className="border-t hairline py-3 pl-5 pr-[max(1.25rem,calc(100%_-_120ch))] text-xs text-slate-500">
            {excluded.length > 0 && `Not ranked because they average fewer than ${MIN_RANKED_USERS} active users a month, or had fewer than ${MIN_RANKED_USERS} by the end of ${label}: ${excluded.map((c) => c.client.name).join(", ")}. `}
            {candidates.length - chosen.ranked.length - excluded.length > 0 && `${candidates.length - chosen.ranked.length - excluded.length} client${candidates.length - chosen.ranked.length - excluded.length === 1 ? " has" : "s have"} no value for this measure in ${label}.`}
          </p>
        )}
      </Card>

      {overall.length > 0 && (
        <Card>
          <CardHeader title="Overall Standings" subtitle={`First places and top-three places across all ${boards.length} rankings above`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-2.5 font-semibold">Client</th><th className="px-3 py-2.5 text-right font-semibold">First Places</th><th className="px-3 py-2.5 text-right font-semibold">Top Three Places</th><th className="px-5 py-2.5 font-semibold">Leads On</th></tr>
              </thead>
              <tbody>
                {overall.slice(0, 10).map((o) => (
                  <tr key={o.insight.client.id} className="border-t hairline">
                    <td className="px-5 py-2.5 font-semibold">{o.insight.client.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{o.golds}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{o.podiums}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-600">{boards.filter((b) => b.ranked.some((r) => r.rank === 1 && r.insight === o.insight)).map((b) => b.m.label).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Every Client, Every Measure" subtitle="Sort any column to compare. #1 to #3 mark the top three in each measure. Select a client to see it against its peers." />
        <DataTable canExport={can(user.role, "export:csv")} exportName={`client-leaderboard-${period}`} rows={tableRows}
          columns={[
            { key: "client", header: "Client" }, { key: "users", header: "Active Users", align: "right", hint: "Average active users per month" },
            ...boards.map((b) => ({ key: b.m.key, header: b.m.label, align: "right" as const, hint: b.m.how })),
          ]} />
        <p className="border-t hairline py-3 pl-5 pr-[max(1.25rem,calc(100%_-_120ch))] text-xs text-slate-500">
          Rates and growth leave out clients averaging fewer than {MIN_RANKED_USERS} active users a month, and clients that had dropped below {MIN_RANKED_USERS} by the end of the period, so a very small or dormant client cannot top a ranking. Growth and Participation Gain also need {MIN_RANKED_USERS} or more people logging in a month a year earlier, so a launch does not count as growth. Widest Feature Use counts {FEATURES.length} features: {FEATURES.map((f) => f.label).join(", ")}.
        </p>
      </Card>
    </div>
  );
}
