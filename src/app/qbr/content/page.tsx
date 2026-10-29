import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { BodySkeleton, PageHeader } from "@/components/dashboard/primitives";
import { ContentView } from "@/components/dashboard/views/content-view";
import { loadQbr } from "@/server/dashboard/context";
import { packRows } from "@/server/dashboard/sections";
import type { SearchParams } from "@/server/services/context";

type Props = { searchParams: Promise<SearchParams> };

export default function ContentPage({ searchParams }: Props) {
  // The header is sent at once; the topic rows stream in behind a skeleton.
  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpen} title="Content & Programs" subtitle="Topics · types · surveys · content health" />
      <Suspense fallback={<BodySkeleton />}>
        <ContentBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ContentBody({ searchParams }: Props) {
  const q = await loadQbr(await searchParams, ["topics", "progress"]);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data } = q.ctx;
  return <ContentView subjects={data.subjects} topics={packRows(data.topics)} stats={packRows(data.topicStats)} progress={data.progress} clientName={data.clientName} />;
}
