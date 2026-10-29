import { BookOpen } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/primitives";
import { ContentView } from "@/components/dashboard/views/content-view";
import { loadQbr } from "@/server/dashboard/context";
import { packRows } from "@/server/dashboard/sections";
import type { SearchParams } from "@/server/services/context";

export default async function ContentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams, ["topics", "progress"]);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data } = q.ctx;
  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpen} title="Content & Programs" subtitle="Topics · types · surveys · content health" />
      <ContentView subjects={data.subjects} topics={packRows(data.topics)} stats={packRows(data.topicStats)} progress={data.progress} clientName={data.clientName} />
    </div>
  );
}
