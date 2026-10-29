import { Brain } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/primitives";
import { KnowledgeView } from "@/components/dashboard/views/knowledge-view";
import { loadQbr } from "@/server/dashboard/context";
import { packRows } from "@/server/dashboard/sections";
import type { SearchParams } from "@/server/services/context";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  // The small core is awaited so the tiles and the frequency table are in the first response; the topic rows follow as a promise.
  const q = await loadQbr(sp);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, canExport } = q.ctx;
  const heavy = loadQbr(sp, ["topics"]).then((r) => {
    if (!r.ok) throw new Error(r.reason);
    return { topics: packRows(r.ctx.data.topics), stats: packRows(r.ctx.data.topicStats) };
  });
  return (
    <div className="space-y-6">
      <PageHeader icon={Brain} title="Knowledge Growth" subtitle="Growth · confidence · topic progress" />
      <KnowledgeView heavy={heavy} knowledge={data.knowledge} frequency={data.frequency} canExport={canExport} />
    </div>
  );
}
