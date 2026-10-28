import { Grid2x2 } from "lucide-react";
import { Card, CardHeader, SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/primitives";
import { QuadrantBubbles } from "@/components/dashboard/dash-charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { loadQbr } from "@/server/dashboard/context";
import type { SearchParams } from "@/server/services/context";
import { fmtNumber, fmtPct } from "@/lib/utils";

const MEANING: Record<string, string> = {
  Experts: "High knowledge, high confidence",
  Graduated: "Strong knowledge, building confidence",
  Intermediate: "Mid-range on both",
  "Needs coaching": "Low knowledge and low confidence",
  Underconfident: "Knows the content but does not trust it",
  Overconfident: "Low knowledge but high confidence",
  "Non-participants": "No training sessions in the latest month",
};

export default async function MatrixPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data } = q.ctx;
  const total = data.matrix.reduce((s, m) => s + m.learners, 0) || 1;

  const rows: TableRow[] = data.matrix.map((m) => ({
    id: m.segment,
    cells: {
      segment: { v: m.segment },
      meaning: { v: MEANING[m.segment] ?? "" },
      learners: { v: m.learners, node: fmtNumber(m.learners) },
      share: { v: m.learners / total, node: fmtPct(m.learners / total, 0) },
      knowledge: { v: m.avgKnowledge, node: fmtPct(m.avgKnowledge, 0) },
      confidence: { v: m.avgConfidence, node: fmtPct(m.avgConfidence, 0) },
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader icon={Grid2x2} title="Knowledge & Confidence Matrix" subtitle="Data that drives performance" />
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader title="Knowledge & Confidence Matrix" subtitle="Bubble size = number of learners · dashed lines mark 50%" />
          <div className="p-4"><QuadrantBubbles points={data.matrix} /></div>
        </Card>
        <Card className="self-start">
          <CardHeader title="Reading the matrix" />
          <ul className="space-y-3 p-4 text-sm">
            <li><strong>Top right:</strong> knows it and trusts it. Keep reinforcing.</li>
            <li><strong>Bottom right:</strong> knows it but lacks confidence. Coach with practice and feedback.</li>
            <li><strong>Top left:</strong> confident but not accurate. Target with corrective content.</li>
            <li><strong>Bottom left:</strong> needs the most support.</li>
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader title="Learner segments" subtitle={`${fmtNumber(total)} learners with knowledge and confidence data`} />
        <DataTable searchable={false} columns={[{ key: "segment", header: "Segment" }, { key: "meaning", header: "What it means" }, { key: "learners", header: "Learners", align: "right" }, { key: "share", header: "Share", align: "right" }, { key: "knowledge", header: "Avg knowledge", align: "right" }, { key: "confidence", header: "Avg confidence", align: "right" }]} rows={rows} />
      </Card>
    </div>
  );
}
