"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { KpiStrip, KpiTile } from "@/components/dashboard/primitives";
import { Donut, HBars, HourColumns } from "@/components/dashboard/dash-charts";
import { ChecklistSlicer } from "@/components/dashboard/slicers";
import { inRange, type Range } from "@/server/dashboard/calc";
import type { FeatureUsage, HourCount, PlatformAccess, UsageMonth } from "@/server/dashboard/types";
import { fmtCompact, fmtNumber } from "@/lib/utils";

export function UsageView({ usageMonthly, platformAccess, hours, features, range }: {
  usageMonthly: UsageMonth[]; platformAccess: PlatformAccess[]; hours: HourCount[]; features: FeatureUsage[]; range: Range;
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

  const donut = platformAccess.filter((p) => sel.size === 0 || sel.has(p.platform)).map((p) => ({ name: p.platform, value: p.logins }));

  return (
    <div className="space-y-6">
      <KpiStrip cols={6}>
        <KpiTile label="Training Hours" value={fmtCompact(totals.trainingHours)} hint="Selected date range" />
        <KpiTile label="Platform Logins" value={fmtCompact(totals.platformLogins)} hint="Selected date range" />
        <KpiTile label="Training Activities" value={fmtCompact(totals.trainingActivities)} hint="Selected date range" />
        <KpiTile label="Games Played" value={fmtCompact(totals.gamesPlayed)} hint="Selected date range" />
        <KpiTile label="Points Spent" value={fmtNumber(totals.pointsSpent)} hint="Selected date range" />
        <KpiTile label="Broadcasts Sent" value={fmtNumber(totals.broadcastsSent)} hint="Selected date range" />
      </KpiStrip>

      <div className="grid gap-4 xl:grid-cols-[14rem_1fr_1fr]">
        <ChecklistSlicer title="Platform" options={options} selected={sel} onChange={setSel} />
        <Card>
          <CardHeader title="Platform Access" subtitle="Logins by device, last 30 days" />
          <div className="p-4"><Donut data={donut} /></div>
        </Card>
        <Card>
          <CardHeader title="Feature Usage % - Last 30 Days" subtitle="Share of active users" />
          <div className="p-4"><HBars data={features.map((f) => ({ name: f.feature, share: f.share }))} nameKey="name" nameWidth={110} series={[{ key: "share", label: "Active users using feature", color: 0 }]} format="pct" maxHeight={260} /></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Training by Time of Day" subtitle="Training activity count by hour, last 30 days (UTC)" />
        <div className="p-4"><HourColumns data={hours} /></div>
      </Card>
    </div>
  );
}
