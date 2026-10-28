"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { KpiStrip, KpiTile, ScopeTag } from "@/components/dashboard/primitives";
import { ProgressStack } from "@/components/dashboard/dash-charts";
import { ChecklistSlicer } from "@/components/dashboard/slicers";
import { sumProgress } from "@/server/dashboard/calc";
import type { SubjectProgress, TopicNode, TopicStat } from "@/server/dashboard/types";
import { fmtCompact, fmtNumber } from "@/lib/utils";

export function ContentView({ subjects, topics, stats, progress, clientName }: {
  subjects: string[]; topics: TopicNode[]; stats: TopicStat[]; progress: SubjectProgress[]; clientName: string;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const subject = sel.size ? [...sel][0] : null;

  const { kpi, prog } = useMemo(() => {
    const leafSubject = new Map(topics.filter((t) => t.parentId).map((t) => [t.id, t.subject]));
    const s = stats.filter((x) => !subject || leafSubject.get(x.topicId) === subject);
    const questions = s.reduce((a, t) => a + t.l1 + t.l2 + t.l3, 0);
    const modules = s.reduce((a, t) => a + t.modules, 0);
    return {
      kpi: { items: questions + modules, topics: s.length, questions, modules, updated: s.map((t) => t.createdAt).sort().at(-1) ?? "\u2014" },
      prog: progress.filter((p) => !subject || p.subject === subject),
    };
  }, [topics, stats, progress, subject]);

  const total = sumProgress(prog);
  const byLevel = ([3, 2, 1] as const).map((level) => ({ label: `Level ${level}`, ...sumProgress(prog.filter((p) => p.level === level)) }));

  return (
    <div className="space-y-6">
      <KpiStrip>
        <KpiTile label="Content Items" scope="snapshot" value={fmtCompact(kpi.items)} hint="Released questions plus training modules" />
        <KpiTile label="Active Topics" scope="snapshot" value={fmtNumber(kpi.topics)} />
        <KpiTile label="Released Questions" scope="snapshot" value={fmtCompact(kpi.questions)} />
        <KpiTile label="Last Updated" scope="snapshot" value={kpi.updated} hint="Most recent topic created" />
        <KpiTile label="Training Modules" scope="snapshot" value={fmtNumber(kpi.modules)} />
      </KpiStrip>

      <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="User Topic Progress Records" badge={<ScopeTag scope="snapshot" />} subtitle={subject ? `Subject: ${subject}` : "All subjects"} />
            <div className="p-4"><ProgressStack data={[{ label: clientName, ...total }]} height={150} /></div>
          </Card>
          <Card>
            <CardHeader title="Content Progression" badge={<ScopeTag scope="snapshot" />} subtitle="By question difficulty level" />
            <div className="p-4"><ProgressStack data={byLevel} /></div>
          </Card>
        </div>
        <ChecklistSlicer title="Subjects" options={subjects} selected={sel} onChange={(n) => setSel(n.size > 1 ? new Set([[...n].at(-1)!]) : n)} single />
      </div>
    </div>
  );
}
