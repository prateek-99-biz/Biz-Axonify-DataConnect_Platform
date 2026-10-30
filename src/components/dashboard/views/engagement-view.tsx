"use client";

import { Suspense, use, useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { KpiStrip, KpiTile, ScopeTag, SectionSkeleton, TrendPill } from "@/components/dashboard/primitives";
import { DualAxisLine } from "@/components/dashboard/dash-charts";
import { TreeSlicer } from "@/components/dashboard/slicers";
import { aggregateMonths, descendants, inRange, monthAxisLabel, teamRows, withCoveredParents, type Range } from "@/server/dashboard/calc";
import type { MonthEngagement } from "@/server/dashboard/types";
import { fmtNumber, fmtPct } from "@/lib/utils";
import { titleCase } from "@/lib/labels";
import { teamMonthsOf, type HeavyTeams } from "./heavy";

const TREND_RANK = { Declining: 0, Stable: 1, "No prior data": 2, Rising: 3 } as const;

/**
 * The headline tiles and the chart come from `months` (the account-level roll-up, already in the first response) while
 * no team is selected, so they paint before the team rows arrive. A selection needs the rows and can only be made once
 * the team list, which comes from the same `heavy` data, is on screen.
 */
export function EngagementView({ months: coreMonths, heavy, range, canExport, asOf }: {
  months: MonthEngagement[]; heavy: Promise<HeavyTeams>; range: Range; canExport: boolean; asOf: string;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const loaded = sel.size ? use(heavy) : null;

  const months = useMemo(() => {
    if (!loaded) return coreMonths.filter((m) => inRange(m.month, range.from, range.to)).sort((a, b) => a.month.localeCompare(b.month));
    const keep = withCoveredParents(loaded.teams, sel);
    const scoped = teamMonthsOf(loaded).filter((t) => inRange(t.month, range.from, range.to) && keep.has(t.teamId));
    return aggregateMonths(scoped, loaded.teams);
  }, [loaded, coreMonths, range, sel]);

  const latest = months.at(-1);
  const part = latest && latest.activeUsers ? latest.trainingUsers / latest.activeUsers : null;
  const chart = months.map((m) => ({ month: monthAxisLabel(m.month, asOf), participation: m.activeUsers ? m.trainingUsers / m.activeUsers : null, frequency: m.frequency }));

  return (
    <div className="space-y-6">
      <KpiStrip>
        <KpiTile label="Training Participation" metric="participation" scope="month" value={fmtPct(part, 0)} hint="Training users ÷ active users, latest month" />
        <KpiTile label="Average Time per Day" metric="time" scope="month" value={latest ? latest.avgTimePerDayMin.toFixed(1) : "—"} hint="Minutes per active user" />
        <KpiTile label="Average Frequency" metric="frequency" scope="month" value={latest ? latest.frequency.toFixed(1) : "—"} hint="Days active per logged-in user" />
        <KpiTile label="Logged-In Users" metric="loggedIn" scope="month" value={fmtNumber(latest?.loggedInUsers)} hint="Users with at least one session" />
        <KpiTile label="Training Users" metric="trainingUsers" scope="month" value={fmtNumber(latest?.trainingUsers)} hint="Active users with a training session" />
      </KpiStrip>

      <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <Suspense fallback={<SectionSkeleton className="h-96" />}>
          <TeamSlicer heavy={heavy} sel={sel} onChange={setSel} />
        </Suspense>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Training Participation and Average Frequency by Month" badge={<ScopeTag scope="range" />} subtitle={sel.size ? "Filtered to the selected teams" : "All teams"} />
            <div className="p-4">
              <DualAxisLine data={chart} xKey="month" left={{ key: "participation", label: "Training Participation", format: "pct" }} right={{ key: "frequency", label: "Average Frequency", format: "decimal" }} />
            </div>
          </Card>
          <Suspense fallback={<SectionSkeleton className="h-80" />}>
            <TeamTable heavy={heavy} sel={sel} range={range} canExport={canExport} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function TeamSlicer({ heavy, sel, onChange }: { heavy: Promise<HeavyTeams>; sel: Set<string>; onChange: (s: Set<string>) => void }) {
  const { teams } = use(heavy);
  return <TreeSlicer title="Teams" nodes={teams} selected={sel} onChange={onChange} />;
}

function TeamTable({ heavy, sel, range, canExport }: { heavy: Promise<HeavyTeams>; sel: Set<string>; range: Range; canExport: boolean }) {
  const h = use(heavy);
  const rows: TableRow[] = useMemo(() => {
    const keep = sel.size ? descendants(h.teams, sel) : null;
    return teamRows(h.teams, teamMonthsOf(h), range)
      .filter((r) => !keep || keep.has(r.team.id))
      .sort((a, b) => TREND_RANK[a.trend] - TREND_RANK[b.trend] || (a.participation ?? 0) - (b.participation ?? 0))
      .map((r) => ({
        id: r.team.id,
        cells: {
          team: { v: r.team.name },
          participation: { v: r.participation, node: fmtPct(r.participation, 0) },
          frequency: { v: r.frequency, node: r.frequency == null ? "—" : r.frequency.toFixed(1) },
          trend: { v: titleCase(r.trend), node: <TrendPill trend={r.trend} /> },
        },
      }));
  }, [h, range, sel]);

  return (
    <Card>
      <CardHeader title="Teams" badge={<ScopeTag scope="month" />} subtitle="Latest month in range, month-over-month trend (±3 participation points)" />
      <DataTable canExport={canExport} exportName="engagement-teams" pageSize={12}
        columns={[{ key: "team", header: "Team" }, { key: "participation", header: "Team Training Participation", align: "right" }, { key: "frequency", header: "Team Frequency (Days)", align: "right" }, { key: "trend", header: "Team Trend" }]}
        rows={rows} />
    </Card>
  );
}
