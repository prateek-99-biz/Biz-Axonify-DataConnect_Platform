"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { KpiStrip, KpiTile, ScopeTag, TrendPill } from "@/components/dashboard/primitives";
import { DualAxisLine } from "@/components/dashboard/dash-charts";
import { TreeSlicer } from "@/components/dashboard/slicers";
import { aggregateMonths, descendants, inRange, monthAxisLabel, teamRows, type Range } from "@/server/dashboard/calc";
import type { TeamMonth, TeamNode } from "@/server/dashboard/types";
import { fmtNumber, fmtPct } from "@/lib/utils";

const TREND_RANK = { Declining: 0, Stable: 1, "No prior data": 2, Rising: 3 } as const;

export function EngagementView({ teams, teamMonths, range, canExport, asOf }: { teams: TeamNode[]; teamMonths: TeamMonth[]; range: Range; canExport: boolean; asOf: string }) {
  const [sel, setSel] = useState<Set<string>>(new Set());

  const scoped = useMemo(() => {
    const keep = sel.size ? descendants(teams, sel) : null;
    return teamMonths.filter((t) => inRange(t.month, range.from, range.to) && (!keep || keep.has(t.teamId)));
  }, [teams, teamMonths, range, sel]);

  const months = useMemo(() => aggregateMonths(scoped, teams), [scoped, teams]);
  const latest = months.at(-1);
  const part = latest && latest.activeUsers ? latest.trainingUsers / latest.activeUsers : null;

  const chart = months.map((m) => ({ month: monthAxisLabel(m.month, asOf), participation: m.activeUsers ? m.trainingUsers / m.activeUsers : null, frequency: m.frequency }));

  const rows: TableRow[] = useMemo(() => {
    const keep = sel.size ? descendants(teams, sel) : null;
    return teamRows(teams, teamMonths, range)
      .filter((r) => !keep || keep.has(r.team.id))
      .sort((a, b) => TREND_RANK[a.trend] - TREND_RANK[b.trend] || (a.participation ?? 0) - (b.participation ?? 0))
      .map((r) => ({
        id: r.team.id,
        cells: {
          team: { v: r.team.name },
          participation: { v: r.participation, node: fmtPct(r.participation, 0) },
          frequency: { v: r.frequency, node: r.frequency == null ? "\u2014" : r.frequency.toFixed(1) },
          trend: { v: r.trend, node: <TrendPill trend={r.trend} /> },
        },
      }));
  }, [teams, teamMonths, range, sel]);

  return (
    <div className="space-y-6">
      <KpiStrip>
        <KpiTile label="Training Participation" metric="participation" scope="month" value={fmtPct(part, 0)} hint="Training users ÷ active users, latest month" />
        <KpiTile label="Avg Time / Day" metric="time" scope="month" value={latest ? latest.avgTimePerDayMin.toFixed(1) : "\u2014"} hint="Minutes per active user" />
        <KpiTile label="Avg Frequency" metric="frequency" scope="month" value={latest ? latest.frequency.toFixed(1) : "\u2014"} hint="Days active per logged-in user" />
        <KpiTile label="Logged-in Users" metric="loggedIn" scope="month" value={fmtNumber(latest?.loggedInUsers)} hint="Users with at least one session" />
        <KpiTile label="Training Users" metric="trainingUsers" scope="month" value={fmtNumber(latest?.trainingUsers)} hint="Active users with a training session" />
      </KpiStrip>

      <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <TreeSlicer title="Teams" nodes={teams} selected={sel} onChange={setSel} />
        <div className="space-y-4">
          <Card>
            <CardHeader title="Training Participation and Avg Frequency by Month" badge={<ScopeTag scope="range" />} subtitle={sel.size ? "Filtered to the selected teams" : "All teams"} />
            <div className="p-4">
              <DualAxisLine data={chart} xKey="month" left={{ key: "participation", label: "Training participation", format: "pct" }} right={{ key: "frequency", label: "Avg frequency", format: "decimal" }} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Teams" badge={<ScopeTag scope="month" />} subtitle="Latest month in range, month-over-month trend (±3 participation points)" />
            <DataTable canExport={canExport} exportName="engagement-teams" pageSize={12}
              columns={[{ key: "team", header: "Team" }, { key: "participation", header: "Team training participation", align: "right" }, { key: "frequency", header: "Team frequency (days)", align: "right" }, { key: "trend", header: "Team trend" }]}
              rows={rows} />
          </Card>
        </div>
      </div>
    </div>
  );
}
