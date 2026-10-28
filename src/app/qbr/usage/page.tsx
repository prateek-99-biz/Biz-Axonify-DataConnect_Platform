import { Cog } from "lucide-react";
import { SourceUnavailable } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/primitives";
import { UsageView } from "@/components/dashboard/views/usage-view";
import { loadQbr } from "@/server/dashboard/context";
import type { SearchParams } from "@/server/services/context";

export default async function UsagePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = await loadQbr(await searchParams);
  if (!q.ok) return <SourceUnavailable reason={q.reason} />;
  const { data, range } = q.ctx;
  return (
    <div className="space-y-6">
      <PageHeader icon={Cog} title="Usage & Activity" subtitle="Hours · games · rewards · platform" />
      <UsageView usageMonthly={data.usageMonthly} platformAccess={data.platformAccess} hours={data.hours} features={data.features} range={range} asOf={data.asOf} />
    </div>
  );
}
