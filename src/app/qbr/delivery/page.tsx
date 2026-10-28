import { Package } from "lucide-react";
import { Card, CardHeader, SourceUnavailable } from "@/components/ui/primitives";
import { InternalNote, KpiStrip, KpiTile, PageHeader } from "@/components/dashboard/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/primitives";
import { loadQbr } from "@/server/dashboard/context";
import type { SearchParams } from "@/server/services/context";
import { fmtNumber } from "@/lib/utils";

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, canExport, internal } = q.ctx;
  const active = data.groups.filter((g) => g.status === "Active");
  const avg = (f: (g: (typeof active)[number]) => number) => (active.length ? active.reduce((s, g) => s + f(g), 0) / active.length : null);
  const max = (f: (g: (typeof active)[number]) => number) => (active.length ? Math.max(...active.map(f)) : null);
  const dash = (n: number | null, d = 1) => (n == null ? "\u2014" : fmtNumber(n, d));
  const empty = active.length > 0 && active.every((g) => g.programs === 0 && g.reinforcementTopics === 0);

  const rows: TableRow[] = data.groups.map((g) => ({
    id: g.id,
    cells: {
      name: { v: g.name },
      status: { v: g.status, node: <Badge tone={g.status === "Active" ? "good" : "neutral"}>{g.status}</Badge> },
      programs: { v: g.programs, node: fmtNumber(g.programs) },
      reinforcement: { v: g.reinforcementTopics, node: fmtNumber(g.reinforcementTopics) },
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="Content Delivery" subtitle="How much content is being assigned to people and groups?" />
      <KpiStrip cols={6}>
        <KpiTile label="Avg Question Pool" value={fmtNumber(data.delivery.avgQuestionPool, 0)} hint="Released questions per assigned topic" />
        <KpiTile label="Est. Months to Graduate" value={dash(data.delivery.estimatedMonthsToGraduate)} />
        <KpiTile label="Avg Programs / Group" value={dash(avg((g) => g.programs))} hint="Active groups" />
        <KpiTile label="Max Programs / Group" value={dash(max((g) => g.programs), 0)} />
        <KpiTile label="Avg Reinforcement / Group" value={dash(avg((g) => g.reinforcementTopics))} hint="Active groups" />
        <KpiTile label="Max Reinforcement / Group" value={dash(max((g) => g.reinforcementTopics), 0)} />
      </KpiStrip>
      {internal && empty && <InternalNote>Every active group shows 0 programs and 0 reinforcement topics. The source report had the same gap, so check the assignment data before presenting this page.</InternalNote>}
      <Card>
        <CardHeader title="Training groups" subtitle="Programs and reinforcement topics assigned per group" />
        <DataTable canExport={canExport} exportName="training-groups" pageSize={12}
          columns={[{ key: "name", header: "Training group" }, { key: "status", header: "Status" }, { key: "programs", header: "Programs assigned", align: "right" }, { key: "reinforcement", header: "Reinforcement topics assigned", align: "right" }]}
          rows={rows} />
      </Card>
    </div>
  );
}
