import { Suspense } from "react";
import { ScanSearch } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { BodySkeleton, PageHeader } from "@/components/dashboard/primitives";
import { TopicsView } from "@/components/dashboard/views/topics-view";
import { loadQbr } from "@/server/dashboard/context";
import { packRows } from "@/server/dashboard/sections";
import type { SearchParams } from "@/server/services/context";

type Props = { searchParams: Promise<SearchParams> };

export default function TopicsPage({ searchParams }: Props) {
  // The header is sent at once; the topic rows stream in behind a skeleton.
  return (
    <div className="space-y-6">
      <PageHeader icon={ScanSearch} title="Topic Performance & Content Coverage" subtitle="Learning objectives & question-level detail" />
      <Suspense fallback={<BodySkeleton />}>
        <TopicsBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TopicsBody({ searchParams }: Props) {
  const q = await loadQbr(await searchParams, ["topics"]);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, canExport, internal } = q.ctx;
  return <TopicsView topics={packRows(data.topics)} stats={packRows(data.topicStats)} canExport={canExport} internal={internal} />;
}
