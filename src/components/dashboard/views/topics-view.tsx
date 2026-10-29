"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { KpiStrip, KpiTile, ScopeTag } from "@/components/dashboard/primitives";
import { TreeSlicer } from "@/components/dashboard/slicers";
import { contentFlag, descendants, reviewPriority, saturation, weightedAvg } from "@/server/dashboard/calc";
import type { TopicNode, TopicStat } from "@/server/dashboard/types";
import { unpackRows, type PackedRows } from "@/server/dashboard/sections";
import { cn, fmtCompact, fmtNumber, fmtPct } from "@/lib/utils";

const WARN_CELL = "rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 dark:bg-amber-400/15 dark:text-amber-200";

export function TopicsView({ topics: topicsP, stats: statsP, canExport, internal }: { topics: PackedRows<TopicNode>; stats: PackedRows<TopicStat>; canExport: boolean; internal: boolean }) {
  const topics = useMemo(() => unpackRows(topicsP), [topicsP]);
  const stats = useMemo(() => unpackRows(statsP), [statsP]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const keep = useMemo(() => (sel.size ? descendants(topics, sel) : null), [topics, sel]);
  const byId = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const scoped = useMemo(() => stats.filter((s) => !keep || keep.has(s.topicId)), [stats, keep]);

  const aud = scoped.reduce((s, t) => s + t.audience, 0);
  const current = weightedAvg(scoped, (t) => t.current);
  const baseline = weightedAvg(scoped, (t) => t.baseline);
  const sum = (f: (t: TopicStat) => number) => scoped.reduce((s, t) => s + f(t), 0);
  const latest = scoped.map((t) => t.createdAt).sort().at(-1);

  const rows: TableRow[] = scoped.map((s) => {
    const flag = contentFlag(s);
    const q = s.l1 + s.l2 + s.l3;
    const levelWarn = (n: number) => n > 12 || (q > 0 && n === 0);
    const cell = (n: number) => ({ v: n, node: levelWarn(n) ? <span className={WARN_CELL}>{n}</span> : n });
    return {
      id: s.topicId,
      cells: {
        topic: { v: byId.get(s.topicId)?.name ?? s.topicId },
        groups: { v: s.targetGroups, node: fmtNumber(s.targetGroups) },
        modules: { v: s.modules, node: fmtNumber(s.modules) },
        l1: cell(s.l1), l2: cell(s.l2), l3: cell(s.l3),
        total: { v: q, node: fmtNumber(q) },
        saturation: { v: saturation(s), node: fmtPct(saturation(s), 0) },
        flag: { v: flag, node: flag === "No warning" ? <span className="text-slate-500">{flag}</span> : <span className={WARN_CELL}>{flag}</span> },
        priority: { v: reviewPriority(s) },
      },
    };
  });

  const columns = [
    { key: "topic", header: "Topic" },
    { key: "groups", header: "Target groups", align: "right" as const },
    { key: "modules", header: "Modules", align: "right" as const },
    { key: "l1", header: "L1", align: "right" as const },
    { key: "l2", header: "L2", align: "right" as const },
    { key: "l3", header: "L3", align: "right" as const },
    { key: "total", header: "Total questions", align: "right" as const },
    { key: "saturation", header: "Saturation", align: "right" as const, hint: "Released questions against a 12-question target (provisional)" },
    ...(internal ? [{ key: "flag", header: "Content flag" }, { key: "priority", header: "Priority", align: "right" as const, hint: "1 = review first, 7 = no issue" }] : []),
  ];

  return (
    <div className="space-y-6">
      <KpiStrip cols={4}>
        <KpiTile label="Current Knowledge" metric="currentKnowledge" scope="snapshot" value={fmtPct(current, 0)} />
        <KpiTile label="Knowledge Lift" metric="lift" scope="snapshot" value={fmtPct(current != null && baseline != null ? current - baseline : null, 0)} hint="Current minus baseline" />
        <KpiTile label="Audience" scope="snapshot" value={fmtCompact(aud)} hint="Learners assigned to the selected topics" />
        <KpiTile label="Training Modules" scope="snapshot" value={fmtNumber(sum((t) => t.modules))} />
        <KpiTile label="Topic Completion (Graduate)" metric="topicCompletion" scope="snapshot" value={fmtPct(weightedAvg(scoped, (t) => t.completion), 0)} />
        <KpiTile label="Released Questions" scope="snapshot" value={fmtCompact(sum((t) => t.l1 + t.l2 + t.l3))} />
        <KpiTile label="Target Groups" scope="snapshot" value={fmtNumber(sum((t) => t.targetGroups))} />
        <KpiTile label="Latest Topic Created" scope="snapshot" value={latest ? new Date(latest).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "\u2014"} />
      </KpiStrip>

      <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
        <TreeSlicer title="Topic selection" nodes={topics} selected={sel} onChange={setSel} />
        <Card className={cn("min-w-0")}>
          <CardHeader title="Topic detail" badge={<ScopeTag scope="snapshot" />} subtitle={internal ? "Content flags and priority are shown to Biz Group staff only" : "Questions per difficulty level and coverage"} />
          <DataTable canExport={canExport} exportName="topic-coverage" columns={columns} rows={rows} pageSize={12} />
        </Card>
      </div>
    </div>
  );
}
