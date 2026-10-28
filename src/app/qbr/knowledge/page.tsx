import { Brain } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/primitives";
import { KnowledgeView } from "@/components/dashboard/views/knowledge-view";
import { loadQbr } from "@/server/dashboard/context";
import type { SearchParams } from "@/server/services/context";

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, canExport } = q.ctx;
  return (
    <div className="space-y-6">
      <PageHeader icon={Brain} title="Knowledge Growth" subtitle="Growth · confidence · topic progress" />
      <KnowledgeView topics={data.topics} stats={data.topicStats} knowledge={data.knowledge} frequency={data.frequency} canExport={canExport} />
    </div>
  );
}
