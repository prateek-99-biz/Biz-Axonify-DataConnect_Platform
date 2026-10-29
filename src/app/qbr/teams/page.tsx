import { Suspense } from "react";
import { Gauge } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { BodySkeleton, PageHeader } from "@/components/dashboard/primitives";
import { TeamsView } from "@/components/dashboard/views/teams-view";
import { loadQbr } from "@/server/dashboard/context";
import { packTeamMonths } from "@/server/dashboard/sections";
import type { SearchParams } from "@/server/services/context";

type Props = { searchParams: Promise<SearchParams> };

export default function TeamsPage({ searchParams }: Props) {
  // The header is sent at once; the team rows stream in behind a skeleton.
  return (
    <div className="space-y-6">
      <PageHeader icon={Gauge} title="Team Performance" subtitle="How are individual teams performing?" />
      <Suspense fallback={<BodySkeleton />}>
        <TeamsBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TeamsBody({ searchParams }: Props) {
  const q = await loadQbr(await searchParams, ["teams"]);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, range, canExport, internal } = q.ctx;
  return <TeamsView teams={data.teams} packed={packTeamMonths(data.teams, data.teamMonths)} range={range} canExport={canExport} internal={internal} />;
}
