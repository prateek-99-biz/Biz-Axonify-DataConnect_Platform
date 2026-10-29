import { Package } from "lucide-react";
import { Card, CardHeader, SourceUnavailable } from "@/components/ui/primitives";
import { InternalNote, KpiStrip, KpiTile, PageHeader, ScopeTag } from "@/components/dashboard/primitives";
import { DeliveryTable } from "@/components/dashboard/views/delivery-table";
import { packRows } from "@/server/dashboard/sections";
import { loadQbr } from "@/server/dashboard/context";
import type { SearchParams } from "@/server/services/context";
import { fmtNumber } from "@/lib/utils";

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams, ["groups"]);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, canExport, internal } = q.ctx;
  const active = data.groups.filter((g) => g.status === "Active");
  const avg = (f: (g: (typeof active)[number]) => number) => (active.length ? active.reduce((s, g) => s + f(g), 0) / active.length : null);
  const max = (f: (g: (typeof active)[number]) => number) => (active.length ? Math.max(...active.map(f)) : null);
  const dash = (n: number | null, d = 1) => (n == null ? "\u2014" : fmtNumber(n, d));
  const empty = active.length > 0 && active.every((g) => g.programs === 0 && g.reinforcementTopics === 0);

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Content Delivery" subtitle="How much content is being assigned to people and groups?" />
      <KpiStrip cols={6}>
        <KpiTile label="Average Question Pool" metric="questionPool" scope="snapshot" value={fmtNumber(data.delivery.avgQuestionPool, 0)} hint="Released questions per assigned topic" />
        <KpiTile label="Estimated Months to Graduate" metric="monthsToGraduate" scope="snapshot" value={dash(data.delivery.estimatedMonthsToGraduate)} />
        <KpiTile label="Average Programs per Group" scope="snapshot" value={dash(avg((g) => g.programs))} hint="Active groups" />
        <KpiTile label="Maximum Programs per Group" scope="snapshot" value={dash(max((g) => g.programs), 0)} />
        <KpiTile label="Average Reinforcement per Group" scope="snapshot" value={dash(avg((g) => g.reinforcementTopics))} hint="Active groups" />
        <KpiTile label="Maximum Reinforcement per Group" scope="snapshot" value={dash(max((g) => g.reinforcementTopics), 0)} />
      </KpiStrip>
      {internal && empty && <InternalNote>Every active group shows 0 programs and 0 reinforcement topics. The source report had the same gap, so check the assignment data before presenting this page.</InternalNote>}
      <Card>
        <CardHeader title="Training Groups" badge={<ScopeTag scope="snapshot" />} subtitle="Programs and reinforcement topics assigned per group" />
        <DeliveryTable groups={packRows(data.groups)} canExport={canExport} />
      </Card>
    </div>
  );
}
