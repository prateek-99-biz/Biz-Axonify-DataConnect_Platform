"use client";

import { Suspense, use, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { DataBar, KpiStrip, KpiTile, ScopeTag, SectionSkeleton } from "@/components/dashboard/primitives";
import { HBars } from "@/components/dashboard/dash-charts";
import { TreeSlicer } from "@/components/dashboard/slicers";
import { descendants, weightedAvg } from "@/server/dashboard/calc";
import type { FrequencyBucket, KnowledgeSummary } from "@/server/dashboard/types";
import { fmtNumber, fmtPct } from "@/lib/utils";
import { topicsOf, type HeavyTopics } from "./heavy";

/**
 * The tiles and the frequency table come from the account-level summary in the first response. The per-topic chart and
 * the topic tree need the topic rows, which follow as a promise; a selection can only be made once the tree is on screen.
 */
export function KnowledgeView({ heavy, knowledge, frequency, canExport }: {
  heavy: Promise<HeavyTopics>; knowledge: KnowledgeSummary; frequency: FrequencyBucket[]; canExport: boolean;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const loaded = sel.size ? topicsOf(use(heavy)) : null;

  const scoped = useMemo(() => {
    if (!loaded) return [];
    const keep = descendants(loaded.topics, sel);
    return loaded.stats.filter((s) => keep.has(s.topicId));
  }, [loaded, sel]);
  const baseline = loaded ? weightedAvg(scoped, (t) => t.baseline) : knowledge.baseline;
  const current = loaded ? weightedAvg(scoped, (t) => t.current) : knowledge.current;
  const completion = loaded ? weightedAvg(scoped, (t) => t.completion) : knowledge.topicCompletion;

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
        <KpiTile label="Baseline Knowledge" metric="baselineKnowledge" scope="snapshot" value={fmtPct(baseline, 0)} hint="Score at first attempt" />
        <KpiTile label="Current Knowledge" metric="currentKnowledge" scope="snapshot" value={fmtPct(current, 0)} hint="Latest score" />
        <KpiTile label="Confidence Level" metric="confidence" scope="snapshot" value={fmtPct(knowledge.confidence, 0)} hint="Includes topics not started (as 0)" />
        <KpiTile label="Experts" metric="experts" scope="snapshot" value={fmtNumber(knowledge.experts)} hint="Learners at 90% or above" />
        <KpiTile label="Topic Completion (Graduate)" metric="topicCompletion" scope="snapshot" value={fmtPct(completion, 0)} hint="Learner-topic records at Graduate" />
      </KpiStrip>

      <Suspense fallback={<div className="grid gap-4 xl:grid-cols-[1fr_22rem]"><SectionSkeleton className="h-96" /><SectionSkeleton className="h-96" /></div>}>
        <TopicExplorer heavy={heavy} sel={sel} onChange={setSel} />
      </Suspense>

      <Card>
        <CardHeader title="Knowledge by Learning Frequency" badge={<ScopeTag scope="snapshot" />} subtitle="Learners who train more often know more and gain more" />
        <DataTable searchable={false} canExport={canExport} exportName="knowledge-by-frequency"
          columns={[{ key: "bucket", header: "Frequency" }, { key: "users", header: "Frequency User %", align: "right" }, { key: "current", header: "Current Knowledge", align: "right" }, { key: "lift", header: "Knowledge Lift", align: "right" }]}
          rows={rows} />
      </Card>
    </div>
  );
}

function TopicExplorer({ heavy, sel, onChange }: { heavy: Promise<HeavyTopics>; sel: Set<string>; onChange: (s: Set<string>) => void }) {
  const { topics, stats } = topicsOf(use(heavy));
  const byId = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const bars = useMemo(() => {
    const keep = sel.size ? descendants(topics, sel) : null;
    return stats
      .filter((s) => !keep || keep.has(s.topicId))
      .filter((s) => s.current != null && s.baseline != null)
      .map((s) => ({ name: byId.get(s.topicId)?.name ?? s.topicId, current: s.current as number, baseline: s.baseline as number }))
      .sort((a, b) => b.current - a.current);
  }, [topics, stats, byId, sel]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader title="Knowledge Growth by Topic" badge={<ScopeTag scope="snapshot" />} subtitle={`${bars.length} topic${bars.length === 1 ? "" : "s"} · current vs baseline`} />
        <div className="p-4">
          {bars.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No topics selected.</p> : (
            <HBars data={bars} nameKey="name" nameWidth={230} series={[{ key: "current", label: "Current Knowledge", color: 2 }, { key: "baseline", label: "Baseline Knowledge", color: 5 }]} />
          )}
        </div>
      </Card>
      <TreeSlicer title="Topics" nodes={topics} selected={sel} onChange={onChange} />
    </div>
  );
}
