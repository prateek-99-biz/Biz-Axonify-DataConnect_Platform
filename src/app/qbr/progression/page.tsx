import { Layers } from "lucide-react";
import { Card, CardHeader, SourceUnavailable } from "@/components/ui/primitives";
import { InternalNote, KpiStrip, KpiTile, PageHeader, ScopeTag } from "@/components/dashboard/primitives";
import { ProgressStack } from "@/components/dashboard/dash-charts";
import { PROGRESS_LABEL, PROGRESS_ORDER, sumProgress, totalOf } from "@/server/dashboard/calc";
import { loadQbr } from "@/server/dashboard/context";
import type { SearchParams } from "@/server/services/context";
import { fmtCompact, fmtPct } from "@/lib/utils";

export default async function ProgressionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams, ["progress"]);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, internal } = q.ctx;

  const levels = ([3, 2, 1] as const).map((level) => ({ level, counts: sumProgress(data.progress.filter((p) => p.level === level)) }));
  const all = sumProgress(levels.map((l) => ({ counts: l.counts })));
  const total = totalOf(all);

  return (
    <div className="space-y-6">
      <PageHeader icon={Layers} title="Content Progression" subtitle="Where are users in their learning journey across L1, L2 and L3?" />
      <KpiStrip cols={3}>
        <KpiTile label="Graduate / Expert %" metric="graduateExpert" scope="snapshot" value={fmtPct(total ? (all.graduate + all.expert) / total : null, 0)} hint="Share of learner-topic records" />
        <KpiTile label="Not Started %" metric="notStarted" scope="snapshot" value={fmtPct(total ? all.notStarted / total : null, 0)} />
        <KpiTile label="User-Topic Records" scope="snapshot" value={fmtCompact(total)} />
      </KpiStrip>
      {internal && <InternalNote>Each row is a share of that level&apos;s own records and sums to 100%. The source report&apos;s matrix did not sum to 100%, which pointed at a wrong denominator.</InternalNote>}

      <Card>
        <CardHeader title="Progress by question level" badge={<ScopeTag scope="snapshot" />} subtitle="Share of learner-topic records at each status" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b hairline bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-5 py-2.5 text-left font-semibold">Question level</th>
                {PROGRESS_ORDER.map((k) => <th key={k} scope="col" className="px-5 py-2.5 text-right font-semibold">{PROGRESS_LABEL[k]}</th>)}
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => {
                const t = totalOf(l.counts);
                return (
                  <tr key={l.level} className="border-b hairline last:border-0">
                    <th scope="row" className="px-5 py-3 text-left font-semibold">Level {l.level}</th>
                    {PROGRESS_ORDER.map((k) => <td key={k} className="px-5 py-3 text-right tabular-nums">{fmtPct(t ? l.counts[k] / t : null, 0)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Content Progression" badge={<ScopeTag scope="snapshot" />} subtitle="Learner-topic records by difficulty level and status" />
        <div className="p-4"><ProgressStack data={levels.map((l) => ({ label: `Level ${l.level}`, ...l.counts }))} height={300} /></div>
      </Card>
    </div>
  );
}
