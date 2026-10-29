import { Activity } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/primitives";
import { EngagementView } from "@/components/dashboard/views/engagement-view";
import { loadQbr } from "@/server/dashboard/context";
import { packTeamMonths } from "@/server/dashboard/sections";
import type { SearchParams } from "@/server/services/context";

export default async function EngagementPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  // The small core is awaited so the headline numbers are in the first response; the team rows follow as a promise.
  const q = await loadQbr(sp);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, range, canExport } = q.ctx;
  const heavy = loadQbr(sp, ["teams"]).then((r) => {
    if (!r.ok) throw new Error(r.reason);
    return { teams: r.ctx.data.teams, packed: packTeamMonths(r.ctx.data.teams, r.ctx.data.teamMonths) };
  });
  return (
    <div className="space-y-6">
      <PageHeader icon={Activity} title="Engagement Overview" subtitle="Participation · frequency · active users · training users" />
      <EngagementView months={data.months} heavy={heavy} range={range} canExport={canExport} asOf={data.asOf} />
    </div>
  );
}
