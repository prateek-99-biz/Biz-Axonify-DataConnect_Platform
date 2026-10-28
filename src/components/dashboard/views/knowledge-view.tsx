"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { DataBar, KpiStrip, KpiTile } from "@/components/dashboard/primitives";
import { HBars } from "@/components/dashboard/dash-charts";
import { TreeSlicer } from "@/components/dashboard/slicers";
import { descendants, weightedAvg } from "@/server/dashboard/calc";
import type { FrequencyBucket, KnowledgeSummary, TopicNode, TopicStat } from "@/server/dashboard/types";
import { fmtNumber, fmtPct } from "@/lib/utils";

export function KnowledgeView({ topics, stats, knowledge, frequency, canExport }: {
  topics: TopicNode[]; stats: TopicStat[]; knowledge: KnowledgeSummary; frequency: FrequencyBucket[]; canExport: boolean;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const keep = useMemo(() => (sel.size ? descendants(topics, sel) : null), [topics, sel]);
  const byId = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  const scoped = useMemo(() => stats.filter((s) => !keep || keep.has(s.topicId)), [stats, keep]);
  const baseline = sel.size ? weightedAvg(scoped, (t) => t.baseline) : knowledge.baseline;
  const current = sel.size ? weightedAvg(scoped, (t) => t.current) : knowledge.current;
  const completion = sel.size ? weightedAvg(scoped, (t) => t.completion) : knowledge.topicCompletion;

  const bars = scoped
    .filter((s) => s.current != null && s.baseline != null)
    .map((s) => ({ name: byId.get(s.topicId)?.name ?? s.topicId, current: s.current as number, baseline: s.baseline as number }))
    .sort((a, b) => b.current - a.current);

  const rows: TableRow[] = frequency.map((f) => ({
    id: f.bucket,
    cells: {
      bucket: { v: f.bucket },
      users: { v: f.userShare, node: fmtPct(f.userShare, 0) },
      current: { v: f.currentKnowledge, node: <DataBar value={f.currentKnowledge} /> },
      lift: { v: f.knowledgeLift, node: <DataBar value={f.knowledgeLift} /> },
    },
  }));

  return (
    <div className="space-y-6">
      <KpiStrip>
        <KpiTile label="Baseline Knowledge" value={fmtPct(baseline, 0)} hint="Score at first attempt" />
        <KpiTile label="Current Knowledge" value={fmtPct(current, 0)} hint="Latest score" />
        <KpiTile label="Confidence Level" value={fmtPct(knowledge.confidence, 0)} hint="Self-reported confidence" />
        <KpiTile label="Experts" value={fmtNumber(knowledge.experts)} hint="Learners at 90% or above" />
        <KpiTile label="Topic Completion" value={fmtPct(completion, 0)} hint="Learner-topic records at Graduate" />
      </KpiStrip>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader title="Knowledge growth by topic" subtitle={`${bars.length} topic${bars.length === 1 ? "" : "s"} \u00b7 current vs baseline`} />
          <div className="p-4">
            {bars.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No topics selected.</p> : (
              <HBars data={bars} nameKey="name" nameWidth={230} series={[{ key: "current", label: "Current knowledge", color: 2 }, { key: "baseline", label: "Baseline knowledge", color: 5 }]} />
            )}
          </div>
        </Card>
        <TreeSlicer title="Topics" nodes={topics} selected={sel} onChange={setSel} />
      </div>

      <Card>
        <CardHeader title="Knowledge by learning frequency" subtitle="Learners who train more often know more and gain more" />
        <DataTable searchable={false} canExport={canExport} exportName="knowledge-by-frequency"
          columns={[{ key: "bucket", header: "Frequency" }, { key: "users", header: "Frequency user %", align: "right" }, { key: "current", header: "Current knowledge", align: "right" }, { key: "lift", header: "Knowledge lift", align: "right" }]}
          rows={rows} />
      </Card>
    </div>
  );
}
