import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import type { SearchParams } from "@/server/services/context";
import { loadInsights } from "@/server/services/insights-context";
import { peerAverage, type ClientInsight } from "@/server/services/insights";
import { FEATURES } from "@/server/metrics/features";
import { periodKey, periodLabel } from "@/server/metrics/period";
import { Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { CompareBars } from "@/components/charts/charts";
import { PeriodNotice } from "@/components/internal/period-notice";
import { ClientPicker, InsightsHeader, MeterRow, PlainSummary, Stat, UsageNotice } from "@/components/insights/ui";
import { cn, fmtNumber, fmtPct } from "@/lib/utils";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `words` is how the measure reads inside a sentence. Features in Use is a count, so it is left out of the lead and gap lines. */
interface Measure { key: string; label: string; words: string; pick: (c: ClientInsight) => number | null; usage: boolean; inSentences: boolean }

const MEASURES: Measure[] = [
  { key: "participation", label: "Participation", words: "participation", pick: (c) => c.health?.participationRate ?? null, usage: false, inSentences: true },
  { key: "engagement", label: "Engagement", words: "engagement", pick: (c) => c.usage.engagement, usage: true, inSentences: true },
  { key: "knowledge", label: "Knowledge", words: "knowledge", pick: (c) => c.health?.avgKnowledge ?? null, usage: false, inSentences: true },
  { key: "max", label: "Max Adoption", words: "Max adoption", pick: (c) => (c.hasUsage ? c.usage.maxAdoption : null), usage: true, inSentences: true },
  { key: "comms", label: "Broadcast Reach", words: "broadcast reach", pick: (c) => (c.hasUsage ? c.usage.commsReach : null), usage: true, inSentences: true },
  { key: "features", label: "Features in Use", words: "features in use", pick: (c) => c.usage.featureBreadth, usage: true, inSentences: false },
];

const pts = (a: number | null, b: number | null) => (a == null || b == null ? null : (a - b) * 100);
const signedPts = (d: number) => `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} pts`;

export default async function BenchmarksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission("dashboard:internal");
  const sp = await searchParams;
  const loaded = await loadInsights(sp);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx, insights, usageReason } = loaded;
  const period = periodKey(ctx.filters.period);
  const label = periodLabel(ctx.filters.period);

  const withData = insights.clients.filter((c) => c.view || c.hasUsage);
  if (withData.length < 2) {
    return <EmptyState title="Benchmarks need at least two clients">Only {withData.length} client has data for {label}. Choose another period.</EmptyState>;
  }
  // Default to the biggest client, which is usually the one people ask about first.
  const biggest = [...withData].sort((a, b) => (b.usage.avgActiveUsers ?? b.health?.activeUsers ?? 0) - (a.usage.avgActiveUsers ?? a.health?.activeUsers ?? 0))[0];
  const focus = withData.find((c) => c.client.id === one(sp.focus)) ?? biggest;
  const others = withData.filter((c) => c !== focus);
  const industry = focus.client.industry && focus.client.industry !== "Unknown" ? focus.client.industry : null;
  const sameIndustry = industry ? others.filter((c) => c.client.industry === industry) : [];

  const groups = [
    { key: "client", label: focus.client.name, members: [focus] },
    ...(sameIndustry.length ? [{ key: "industry", label: `Other ${industry} Clients (${sameIndustry.length})`, members: sameIndustry }] : []),
    { key: "all", label: `All Other Biz Group Clients (${others.length})`, members: others },
  ];
  const shown = MEASURES.filter((m) => !m.usage || insights.hasUsage);
  const chart = shown.map((m) => Object.fromEntries([["measure", m.label], ...groups.map((g) => [g.key, peerAverage(g.members, m.pick)])]));

  // Plain-words comparison against all other clients.
  const vsAll = shown.map((m) => ({ m, mine: m.pick(focus), avg: peerAverage(others, m.pick) })).filter((x) => x.mine != null && x.avg != null);
  const above = vsAll.filter((x) => x.mine! > x.avg!);
  const rates = vsAll.filter((x) => x.m.inSentences);
  const biggestGap = [...rates].sort((a, b) => (a.mine! - a.avg!) - (b.mine! - b.avg!))[0];
  const biggestLead = [...rates].sort((a, b) => (b.mine! - b.avg!) - (a.mine! - a.avg!))[0];
  const untapped = insights.hasUsage ? FEATURES.filter((f) => (focus.usage.featureShare[f.key] ?? 0) === 0 && others.filter((o) => (o.usage.featureShare[f.key] ?? 0) > 0).length >= Math.ceil(others.length / 2)) : [];

  const summary = [
    vsAll.length ? `${focus.client.name} is above the average of the other ${others.length} Biz Group clients on ${above.length} of ${vsAll.length} measures.` : "",
    biggestLead && biggestLead.mine! > biggestLead.avg! ? `Strongest lead: ${biggestLead.m.words}, ${fmtPct(biggestLead.mine)} against ${fmtPct(biggestLead.avg)} (${signedPts(pts(biggestLead.mine, biggestLead.avg)!)}).` : "",
    biggestGap && biggestGap.mine! < biggestGap.avg! ? `Biggest gap: ${biggestGap.m.words}, ${fmtPct(biggestGap.mine)} against ${fmtPct(biggestGap.avg)} (${signedPts(pts(biggestGap.mine, biggestGap.avg)!)}).` : "",
    untapped.length ? `Not used yet, though most other clients use them: ${untapped.map((f) => f.label).join(", ")}. A quick win to raise in the next review.` : "",
    !industry ? "No industry is recorded for this client in the Salesforce file, so the comparison is against all clients only." : "",
  ];

  const commsRows: { label: string; mine: number | null; avg: number | null; fmt: (v: number | null) => string }[] = [
    { label: "Broadcasts Sent per Month", mine: focus.usage.months ? focus.usage.broadcastsSent / focus.usage.months : null, avg: peerAverage(others, (o) => (o.usage.months ? o.usage.broadcastsSent / o.usage.months : null)), fmt: (v) => fmtNumber(v, 1) },
    { label: "Opened a Broadcast", mine: focus.usage.commsReach, avg: peerAverage(others, (o) => o.usage.commsReach), fmt: (v) => fmtPct(v) },
    { label: "Answered a Broadcast", mine: focus.usage.commsResponse, avg: peerAverage(others, (o) => o.usage.commsResponse), fmt: (v) => fmtPct(v) },
    { label: "Used Chat", mine: focus.usage.featureShare.chat ?? null, avg: peerAverage(others, (o) => o.usage.featureShare.chat ?? null), fmt: (v) => fmtPct(v) },
    { label: "Viewed Communities", mine: focus.usage.featureShare.communities ?? null, avg: peerAverage(others, (o) => o.usage.featureShare.communities ?? null), fmt: (v) => fmtPct(v) },
  ];

  return (
    <div className="space-y-6">
      <InsightsHeader title="Benchmarks and Features" subtitle={`How one client compares with other Biz Group clients in ${label}, and which Axonify features it uses. Each client counts once in an average.`}>
        <ClientPicker clients={[...withData].sort((a, b) => a.client.name.localeCompare(b.client.name)).map((c) => c.client)} selected={focus.client.id} period={period} label="Client" />
      </InsightsHeader>
      <PeriodNotice label={label} progress={ctx.progress} asOf={ctx.asOf} />
      <UsageNotice reason={usageReason} />
      <PlainSummary points={summary} />

      <section aria-label="Headline comparison" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shown.slice(0, 4).map((m) => {
          const mine = m.pick(focus), avg = peerAverage(others, m.pick), d = pts(mine, avg);
          return (
            <Card key={m.key} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{m.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{fmtPct(mine)}</p>
              <p className="mt-1 text-xs text-slate-500">Biz Group average {fmtPct(avg)}{d != null && <span className={cn("ml-1 font-semibold", d >= 0 ? "text-brand-ink" : "text-critical")}>({signedPts(d)})</span>}</p>
            </Card>
          );
        })}
      </section>

      <Card>
        <CardHeader title="Client vs Peers" subtitle={sameIndustry.length ? `${focus.client.name}, other ${industry} clients and all other Biz Group clients` : `${focus.client.name} against all other Biz Group clients`} />
        <div className="p-4"><CompareBars entities data={chart} xKey="measure" series={groups.map((g) => ({ key: g.key, label: g.label }))} height={300} /></div>
        <p className="border-t hairline px-5 py-3 text-xs text-slate-500">
          An Axonify-wide industry benchmark is not in DataConnect, which holds Biz Group clients only. To compare divisions inside this client, open its <Link href={`/qbr/teams?client=${focus.client.id}`} className="underline">Team Performance</Link> dashboard.
        </p>
      </Card>

      {insights.hasUsage && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Feature Utilisation" subtitle="Share of active users who used each feature in an average month. The black tick is the Biz Group average." />
            <div className="px-5 py-3">
              {FEATURES.map((f) => {
                const mine = focus.usage.featureShare[f.key] ?? null;
                const avg = peerAverage(others, (o) => (o.hasUsage ? o.usage.featureShare[f.key] ?? null : null));
                return <MeterRow key={f.key} label={f.label} note={f.means} value={mine} marker={avg} markerLabel={`Biz Group average ${fmtPct(avg)}`} tone={mine === 0 || mine == null ? "muted" : mine >= (avg ?? 0) ? "good" : "orange"} />;
              })}
            </div>
          </Card>
          <Card>
            <CardHeader title="Communication Utilisation" subtitle="Broadcasts, chat and communities against the Biz Group average" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-2.5 font-semibold">Measure</th><th className="px-3 py-2.5 text-right font-semibold">{focus.client.name}</th><th className="px-3 py-2.5 text-right font-semibold">Biz Group Average</th><th className="px-5 py-2.5 text-right font-semibold">Difference</th></tr>
                </thead>
                <tbody>
                  {commsRows.map((r) => {
                    const diff = r.mine != null && r.avg != null ? r.mine - r.avg : null;
                    return (
                      <tr key={r.label} className="border-t hairline">
                        <td className="px-5 py-2.5">{r.label}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.fmt(r.mine)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{r.fmt(r.avg)}</td>
                        <td className={cn("px-5 py-2.5 text-right tabular-nums", diff == null ? "text-slate-400" : diff >= 0 ? "text-brand-ink" : "text-critical")}>{diff == null ? "—" : `${diff >= 0 ? "+" : "−"}${r.label.startsWith("Broadcasts Sent") ? fmtNumber(Math.abs(diff), 1) : `${(Math.abs(diff) * 100).toFixed(1)} pts`}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t hairline p-5">
              <Stat label="Learning Hours" value={fmtNumber(focus.usage.learningHours)} note={`${fmtNumber(focus.usage.hoursPerUser, 2)} h per active user a month`} />
              <Stat label="Max Questions" value={fmtNumber(focus.usage.maxQueries)} note={<Link href={`/insights/ai?period=${period}`} className="underline">See Max AI usage</Link>} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
