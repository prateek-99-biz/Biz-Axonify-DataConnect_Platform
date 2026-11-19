import { Grid2x2 } from "lucide-react";
import { Card, CardHeader, SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader, ScopeTag } from "@/components/dashboard/primitives";
import { QuadrantBubbles } from "@/components/dashboard/dash-charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { loadQbr } from "@/server/dashboard/context";
import type { SearchParams } from "@/server/services/context";
import { fmtNumber, fmtPct } from "@/lib/utils";

/**
 * The segment rules from the matrix query, checked in this order (first match wins). Knowledge is the learner's average
 * current score; confidence averages every topic level, with levels not started counted as 0.
 */
const MEANING: Record<string, string> = {
  "Non-participants": "No training sessions in the latest month, whatever their scores",
  Graduated: "At Graduate on 95% or more of their topic levels",
  Experts: "Knowledge 90%+ and confidence 70%+",
  Overconfident: "Knowledge under 40% but confidence 70%+",
  Underconfident: "Knowledge 90%+ but confidence under 50%",
  "Needs coaching": "Knowledge under 50% (and not Overconfident)",
  Intermediate: "Everyone else: knowledge 50–90%, or 90%+ with confidence 50–70%",
};
const ORDER = Object.keys(MEANING);

export default async function MatrixPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data } = q.ctx;
  const total = data.matrix.reduce((s, m) => s + m.learners, 0) || 1;

  const rank = (s: string) => (ORDER.includes(s) ? ORDER.indexOf(s) : ORDER.length);
  const rows: TableRow[] = [...data.matrix].sort((a, b) => rank(a.segment) - rank(b.segment)).map((m) => ({
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
          <CardHeader title="Knowledge & Confidence Matrix" badge={<ScopeTag scope="snapshot" />} subtitle="Bubble size = number of learners · dashed lines mark 50%" />
          <div className="p-4"><QuadrantBubbles points={data.matrix} /></div>
        </Card>
        <Card className="self-start">
          <CardHeader title="Reading the Matrix" />
          <ul className="space-y-3 p-4 text-sm">
            <li><strong>Top right:</strong> knows it and trusts it. Keep reinforcing.</li>
            <li><strong>Bottom right:</strong> knows it but lacks confidence. Coach with practice and feedback.</li>
            <li><strong>Top left:</strong> confident but not accurate. Target with corrective content.</li>
            <li><strong>Bottom left:</strong> needs the most support.</li>
          </ul>
          <p className="border-t hairline px-4 py-3 text-xs text-slate-500">
            Each bubble sits at its segment&apos;s average, so a segment can land in any quadrant; the segment rules are in the table
            below. Confidence here averages every topic level, counting levels not started as 0, so it reads lower than the
            Confidence Level on the Knowledge page, which takes each topic&apos;s best level.
          </p>
        </Card>
      </div>
      <Card>
        <CardHeader title="Learner Segments" badge={<ScopeTag scope="snapshot" />} subtitle={`${fmtNumber(total)} learners with knowledge and confidence data · rules are checked top to bottom, first match wins`} />
        <DataTable searchable={false} columns={[{ key: "segment", header: "Segment" }, { key: "meaning", header: "What It Means" }, { key: "learners", header: "Learners", align: "right" }, { key: "share", header: "Share", align: "right" }, { key: "knowledge", header: "Average Knowledge", align: "right" }, { key: "confidence", header: "Average Confidence", align: "right" }]} rows={rows} />
      </Card>
    </div>
  );
}
