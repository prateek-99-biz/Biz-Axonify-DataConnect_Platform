import { Gauge } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/primitives";
import { TeamsView } from "@/components/dashboard/views/teams-view";
import { loadQbr } from "@/server/dashboard/context";
import { packTeamMonths } from "@/server/dashboard/sections";
import type { SearchParams } from "@/server/services/context";

export default async function TeamsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams, ["teams"]);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, range, canExport, internal } = q.ctx;
  return (
    <div className="space-y-6">
      <PageHeader icon={Gauge} title="Team Performance" subtitle="How are individual teams performing?" />
      <TeamsView teams={data.teams} packed={packTeamMonths(data.teams, data.teamMonths)} range={range} canExport={canExport} internal={internal} />
    </div>
  );
}
