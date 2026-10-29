"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { StatusDot, TrendPill, ScopeTag } from "@/components/dashboard/primitives";
import { ChecklistSlicer } from "@/components/dashboard/slicers";
import { teamRows, type Range, type TeamRow, type TeamStatus } from "@/server/dashboard/calc";
import type { TeamNode } from "@/server/dashboard/types";
import { unpackTeamMonths, type PackedTeamMonths } from "@/server/dashboard/sections";
import { fmtNumber, fmtPct } from "@/lib/utils";
import { titleCase } from "@/lib/labels";

const STATUS_BG: Record<TeamStatus, string> = { High: "bg-brand text-navy", Medium: "bg-amber-400 text-navy", Low: "bg-red-600 text-white" };
const STATUS_DOT: Record<TeamStatus, string> = { High: "bg-brand", Medium: "bg-amber-400", Low: "bg-red-600" };

const COLS = [
  { key: "team", header: "Team" },
  { key: "participation", header: "Team Training Participation", align: "right" as const },
  { key: "frequency", header: "Team Frequency", align: "right" as const },
  { key: "users", header: "Team Active Users", align: "right" as const },
  { key: "status", header: "Status" },
];

const toRow = (r: TeamRow): TableRow => ({
  id: r.team.id,
  cells: {
    team: { v: r.team.name },
    participation: { v: r.participation, node: fmtPct(r.participation, 0) },
    frequency: { v: r.frequency, node: r.frequency == null ? "\u2014" : r.frequency.toFixed(2) },
    users: { v: r.activeUsers, node: fmtNumber(r.activeUsers) },
    status: { v: r.status, node: <StatusDot status={r.status} /> },
    trend: { v: titleCase(r.trend), node: <TrendPill trend={r.trend} /> },
  },
});

export function TeamsView({ teams, packed, range, canExport, internal }: { teams: TeamNode[]; packed: PackedTeamMonths; range: Range; canExport: boolean; internal: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const teamMonths = useMemo(() => unpackTeamMonths(teams, packed), [teams, packed]);

  const all_ = useMemo(() => teamRows(teams, teamMonths, range), [teams, teamMonths, range]);
  const rows = useMemo(() => all_.filter((r) => sel.size === 0 || sel.has(r.team.name)), [all_, sel]);
  const names = useMemo(() => [...new Set(all_.map((r) => r.team.name))].sort(), [all_]);

  const count = (s: TeamStatus) => rows.filter((r) => r.status === s).length;
  const counts = { High: count("High"), Medium: count("Medium"), Low: count("Low") };
  const total = rows.length || 1;

  const top = [...rows].filter((r) => r.status === "High").sort((a, b) => (b.participation ?? 0) - (a.participation ?? 0)).slice(0, 10);
  const attention = [...rows].filter((r) => r.status === "Low").sort((a, b) => (a.participation ?? 0) - (b.participation ?? 0)).slice(0, 10);
  const ranked = [...rows].sort((a, b) => (b.participation ?? 0) - (a.participation ?? 0));
  const detailCols = [...COLS, { key: "trend", header: "Trend" }];

  return (
    <div className="grid gap-4 xl:grid-cols-[16rem_1fr]">
      <ChecklistSlicer title="Team Name" options={names} selected={sel} onChange={setSel} />
      <div className="space-y-4">
        <Card>
          <CardHeader title="Team Performance Distribution" badge={<ScopeTag scope="month" />} subtitle={`${rows.length} team${rows.length === 1 ? "" : "s"} \u00b7 status blends participation (\u2265 75% = full score) and frequency (\u2265 6x = full score)`} />
          <div className="p-5">
            <div className="flex h-10 overflow-hidden rounded-xl" role="img" aria-label={`High ${counts.High}, Medium ${counts.Medium}, Low ${counts.Low}`}>
              {(["High", "Medium", "Low"] as const).map((s) => counts[s] > 0 && (
                <div key={s} className={`${STATUS_BG[s]} flex items-center justify-center text-sm font-bold`} style={{ width: `${(counts[s] / total) * 100}%` }} title={`${s}: ${counts[s]}`}>{counts[s]}</div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {(["High", "Medium", "Low"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} aria-hidden />{s} <strong className="tabular-nums">{counts[s]}</strong></span>
              ))}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 2xl:grid-cols-2">
          <Card>
            <CardHeader title="Top Performing Teams" badge={<ScopeTag scope="month" />} subtitle="Highest participation among High-status teams" />
            <DataTable searchable={false} columns={COLS} rows={top.map(toRow)} pageSize={10} emptyTitle="No High-status teams" />
          </Card>
          <Card>
            <CardHeader title="Teams Needing Attention" badge={<ScopeTag scope="month" />} subtitle="Lowest participation among Low-status teams" />
            <DataTable searchable={false} columns={COLS} rows={attention.map(toRow)} pageSize={10} emptyTitle="No Low-status teams" />
          </Card>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setAll((v) => !v)} aria-expanded={all}>{all ? "Hide Details" : "More Details"} <ArrowRight className="h-4 w-4" aria-hidden /></Button>
        </div>

        {all && (
          <Card>
            <CardHeader title="All Teams" badge={<ScopeTag scope="month" />} subtitle={internal ? "Ranked by participation \u00b7 internal export available" : "Ranked by participation"} />
            <DataTable canExport={canExport} exportName="team-performance" columns={detailCols} rows={ranked.map(toRow)} pageSize={15} />
          </Card>
        )}
      </div>
    </div>
  );
}
