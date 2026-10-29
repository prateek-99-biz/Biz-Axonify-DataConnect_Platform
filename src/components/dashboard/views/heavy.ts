import { unpackRows, unpackTeamMonths, type PackedRows, type PackedTeamMonths } from "@/server/dashboard/sections";
import type { TeamMonth, TeamNode, TopicNode, TopicStat } from "@/server/dashboard/types";

/**
 * The large sections of a dashboard, sent after the page shell so the headline numbers can paint first. Pages hand the
 * browser a promise of these; each view reads it with `use` inside a Suspense boundary.
 */
export interface HeavyTeams { teams: TeamNode[]; packed: PackedTeamMonths }
export interface HeavyTopics { topics: PackedRows<TopicNode>; stats: PackedRows<TopicStat> }

// Several components read the same resolved object; unpack it once.
const teamMonths = new WeakMap<HeavyTeams, TeamMonth[]>();
const topics = new WeakMap<HeavyTopics, { topics: TopicNode[]; stats: TopicStat[] }>();

export function teamMonthsOf(h: HeavyTeams): TeamMonth[] {
  let v = teamMonths.get(h);
  if (!v) teamMonths.set(h, (v = unpackTeamMonths(h.teams, h.packed)));
  return v;
}

export function topicsOf(h: HeavyTopics): { topics: TopicNode[]; stats: TopicStat[] } {
  let v = topics.get(h);
  if (!v) topics.set(h, (v = { topics: unpackRows(h.topics), stats: unpackRows(h.stats) }));
  return v;
}
