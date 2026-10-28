import { ScanSearch } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/primitives";
import { TopicsView } from "@/components/dashboard/views/topics-view";
import { loadQbr } from "@/server/dashboard/context";
import type { SearchParams } from "@/server/services/context";

export default async function TopicsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, canExport, internal } = q.ctx;
  return (
    <div className="space-y-6">
      <PageHeader icon={ScanSearch} title="Topic Performance & Content Coverage" subtitle="Learning objectives & question-level detail" />
      <TopicsView topics={data.topics} stats={data.topicStats} canExport={canExport} internal={internal} />
    </div>
  );
}
