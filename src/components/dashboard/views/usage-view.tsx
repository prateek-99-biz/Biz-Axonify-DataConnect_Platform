"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { KpiStrip, KpiTile, ScopeTag } from "@/components/dashboard/primitives";
import { Donut, HBars, HourColumns } from "@/components/dashboard/dash-charts";
import { ChecklistSlicer } from "@/components/dashboard/slicers";
import { inRange, isCurrentMonth, type Range } from "@/server/dashboard/calc";
import type { FeatureUsage, HourCount, PlatformAccess, UsageMonth } from "@/server/dashboard/types";
import { fmtCompact, fmtNumber } from "@/lib/utils";

export function UsageView({ usageMonthly, platformAccess, hours, features, range, asOf }: {
  usageMonthly: UsageMonth[]; platformAccess: PlatformAccess[]; hours: HourCount[]; features: FeatureUsage[]; range: Range; asOf: string;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const options = platformAccess.map((p) => p.platform);

  const totals = useMemo(() => {
    const m = usageMonthly.filter((u) => inRange(u.month, range.from, range.to));
    const sum = (f: (u: UsageMonth) => number) => m.reduce((s, u) => s + f(u), 0);
    return {
      trainingHours: sum((u) => u.trainingHours), platformLogins: sum((u) => u.platformLogins), trainingActivities: sum((u) => u.trainingActivities),
      gamesPlayed: sum((u) => u.gamesPlayed), pointsSpent: sum((u) => u.pointsSpent), broadcastsSent: sum((u) => u.broadcastsSent),
    };
  }, [usageMonthly, range]);

  const partial = isCurrentMonth(range.to, asOf);
  const donut = platformAccess.filter((p) => sel.size === 0 || sel.has(p.platform)).map((p) => ({ name: p.platform, value: p.logins }));

  return (
    <div className="space-y-6">
      <KpiStrip cols={6}>
        <KpiTile label="Training Hours" scope="range" value={fmtCompact(totals.trainingHours)} hint={partial ? "Includes the current month to date" : "Selected date range"} />
        <KpiTile label="Platform Logins" scope="range" value={fmtCompact(totals.platformLogins)} hint={partial ? "Includes the current month to date" : "Selected date range"} />
        <KpiTile label="Training Activities" scope="range" value={fmtCompact(totals.trainingActivities)} hint={partial ? "Includes the current month to date" : "Selected date range"} />
        <KpiTile label="Games Played" scope="range" value={fmtCompact(totals.gamesPlayed)} hint={partial ? "Includes the current month to date" : "Selected date range"} />
        <KpiTile label="Points Spent" scope="range" value={fmtNumber(totals.pointsSpent)} hint={partial ? "Includes the current month to date" : "Selected date range"} />
        <KpiTile label="Broadcasts Sent" scope="range" value={fmtNumber(totals.broadcastsSent)} hint={partial ? "Includes the current month to date" : "Selected date range"} />
      </KpiStrip>

      <div className="grid gap-4 xl:grid-cols-[14rem_1fr_1fr]">
        <ChecklistSlicer title="Platform" options={options} selected={sel} onChange={setSel} />
        <Card>
          <CardHeader title="Platform Access" badge={<ScopeTag scope="d30" />} subtitle="Logins by device, last 30 days" />
          <div className="p-4"><Donut data={donut} /></div>
        </Card>
        <Card>
          <CardHeader title="Feature Usage % - Last 30 Days" badge={<ScopeTag scope="d30" />} subtitle="Share of active users" />
          <div className="p-4"><HBars data={features.map((f) => ({ name: f.feature, share: f.share }))} nameKey="name" nameWidth={110} series={[{ key: "share", label: "Active Users Using Feature", color: 0 }]} format="pct" maxHeight={260} /></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Training by Time of Day" badge={<ScopeTag scope="d30" />} subtitle="Training activity count by hour, last 30 days (UTC)" />
        <div className="p-4"><HourColumns data={hours} /></div>
      </Card>
    </div>
  );
}
