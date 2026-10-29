import { Activity } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/primitives";
import { EngagementView } from "@/components/dashboard/views/engagement-view";
import { loadQbr } from "@/server/dashboard/context";
import { packTeamMonths } from "@/server/dashboard/sections";
import type { SearchParams } from "@/server/services/context";

export default async function EngagementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams, ["teams"]);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, range, canExport } = q.ctx;
  return (
    <div className="space-y-6">
      <PageHeader icon={Activity} title="Engagement Overview" subtitle="Participation · frequency · active users · training users" />
      <EngagementView teams={data.teams} packed={packTeamMonths(data.teams, data.teamMonths)} range={range} canExport={canExport} asOf={data.asOf} />
    </div>
  );
}
