import type { DashboardData, TeamMonth, TeamNode } from "./types";

/**
 * A dashboard is stored as a small core row plus one row per large section, so a page reads only what it shows.
 * jlearning's dashboard is 4.6 MB, 4 MB of it team rows; the Matrix page needs none of that.
 */
export const SECTIONS = {
  teams: ["teams", "teamMonths"],
  topics: ["topics", "topicStats"],
  groups: ["groups"],
  progress: ["progress"],
} as const satisfies Record<string, readonly (keyof DashboardData)[]>;

export type Section = keyof typeof SECTIONS;
export const SECTION_NAMES = Object.keys(SECTIONS) as Section[];

/** The core row: everything except the sectioned arrays. */
export type DashboardCore = Omit<DashboardData, (typeof SECTIONS)[Section][number]>;

export function splitDashboard(d: DashboardData): { core: DashboardCore; parts: Record<Section, Record<string, unknown>> } {
  const core: Record<string, unknown> = { ...d };
  const parts = {} as Record<Section, Record<string, unknown>>;
  for (const s of SECTION_NAMES) {
    parts[s] = {};
    for (const key of SECTIONS[s]) { parts[s][key] = d[key]; delete core[key]; }
  }
  // Team rows are the bulk of a large client (4 MB for jlearning); stored packed they read from the database several times faster.
  parts.teams.teamMonths = packTeamMonths(d.teams, d.teamMonths);
  return { core: core as unknown as DashboardCore, parts };
}

/**
 * Puts requested sections back. Sections that were not asked for are empty arrays. A snapshot written before the split
 * still carries its arrays in the core row, so those are kept when no part row exists. Team rows are stored packed.
 */
export function joinDashboard(core: DashboardCore, parts: Partial<Record<Section, Record<string, unknown>>>, wanted: readonly Section[]): DashboardData {
  const out: Record<string, unknown> = { ...core };
  for (const s of SECTION_NAMES) {
    for (const key of SECTIONS[s]) {
      const legacy = out[key];
      out[key] = wanted.includes(s) ? parts[s]?.[key] ?? legacy ?? [] : [];
    }
  }
  const tm = out.teamMonths as unknown;
  if (tm && !Array.isArray(tm)) out.teamMonths = unpackTeamMonths(out.teams as TeamNode[], tm as PackedTeamMonths);
  return out as unknown as DashboardData;
}

/** Team-month rows as parallel number arrays: the team ids repeat on every row and dominate the JSON size. */
export interface PackedTeamMonths {
  months: string[];
  /** Index into the teams list. */
  team: number[];
  /** Index into `months`. */
  month: number[];
  active: number[];
  loggedIn: number[];
  training: number[];
  frequency: number[];
  time: number[];
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function packTeamMonths(teams: TeamNode[], rows: TeamMonth[]): PackedTeamMonths {
  const teamIdx = new Map(teams.map((t, i) => [t.id, i]));
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const monthIdx = new Map(months.map((m, i) => [m, i]));
  const p: PackedTeamMonths = { months, team: [], month: [], active: [], loggedIn: [], training: [], frequency: [], time: [] };
  for (const r of rows) {
    const t = teamIdx.get(r.teamId);
    if (t === undefined) continue;
    p.team.push(t);
    p.month.push(monthIdx.get(r.month)!);
    p.active.push(r.activeUsers);
    p.loggedIn.push(r.loggedInUsers);
    p.training.push(r.trainingUsers);
    p.frequency.push(r4(r.frequency));
    p.time.push(r4(r.avgTimePerDayMin));
  }
  return p;
}

export function unpackTeamMonths(teams: TeamNode[], p: PackedTeamMonths): TeamMonth[] {
  return p.team.map((t, i) => ({
    teamId: teams[t].id, month: p.months[p.month[i]], activeUsers: p.active[i], loggedInUsers: p.loggedIn[i],
    trainingUsers: p.training[i], frequency: p.frequency[i], avgTimePerDayMin: p.time[i],
  }));
}

/**
 * Flat rows as columns, with text values replaced by an index into one shared list. Topic and team ids and names repeat
 * on every row, so this cuts the JSON the browser downloads several times over. Numbers and nulls pass through as they are.
 */
export interface PackedRows<T> {
  keys: (keyof T & string)[];
  dict: string[];
  /** One array per key; in a text column a value is a `dict` index, or -1 for null. */
  cols: (number | string | boolean | null)[][];
  /** Which columns hold text. */
  text: boolean[];
  /** Type marker only, never set. */
  _row?: T;
}

export function packRows<T extends object>(rows: T[]): PackedRows<T> {
  const keys = (rows.length ? Object.keys(rows[0]) : []) as (keyof T & string)[];
  const dict: string[] = [];
  const at = new Map<string, number>();
  const text = keys.map((k) => rows.every((r) => { const v = r[k]; return v === null || typeof v === "string"; }) && rows.some((r) => r[k] !== null));
  const cols = keys.map((k, c) => rows.map((r) => {
    const v = r[k] as unknown;
    if (!text[c]) return v as number | boolean | null;
    if (v === null) return -1;
    let i = at.get(v as string);
    if (i === undefined) { i = dict.length; dict.push(v as string); at.set(v as string, i); }
    return i;
  }));
  return { keys, dict, cols, text };
}

export function unpackRows<T extends object>(p: PackedRows<T>): T[] {
  const n = p.cols[0]?.length ?? 0;
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    const row: Record<string, unknown> = {};
    p.keys.forEach((k, c) => { const v = p.cols[c][i]; row[k] = p.text[c] ? (v === -1 ? null : p.dict[v as number]) : v; });
    out.push(row as T);
  }
  return out;
}
