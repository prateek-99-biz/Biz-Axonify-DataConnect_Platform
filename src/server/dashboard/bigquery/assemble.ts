/** Turns raw BigQuery rows for one tenant into the DashboardData the pages read. Pure, so it is unit-tested with fixtures. */
import { aggregateMonths } from "../calc";
import type {
  DashboardData, FeatureUsage, FrequencyBucket, MatrixPoint, Platform, PlatformAccess, ProgressCounts, ProgressStatus, Segment,
  SubjectProgress, TeamMonth, TeamNode, TopicNode, TopicStat, TrainingGroup, UsageMonth,
} from "../types";
import type { QueryName } from "./queries";

export type Row = Record<string, unknown>;
export type RowSet = Record<Exclude<QueryName, "clients" | "clientPeriod">, Row[]>;

/** BigQuery returns INT64/FLOAT64 as numbers (or wrappers with .value) and DATE/DATETIME as wrappers. */
const raw = (v: unknown): unknown => (v && typeof v === "object" && "value" in (v as object) ? (v as { value: unknown }).value : v);
const num = (v: unknown): number => { const x = raw(v); const n = typeof x === "number" ? x : Number(x); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v: unknown): number | null => { const x = raw(v); if (x == null) return null; const n = typeof x === "number" ? x : Number(x); return Number.isFinite(n) ? n : null; };
const str = (v: unknown): string => { const x = raw(v); return x == null ? "" : String(x); };

/** Scores arrive as 0-1 or 0-100 depending on the view; the report treats values above 1 as percentages. */
export const norm01 = (v: unknown): number | null => { const n = numOrNull(v); return n == null ? null : Math.min(1, Math.max(0, n > 1 ? n / 100 : n)); };

/** Confidence is stored on a 0-100 scale (no 0-1 or 0-5 variants), so it is always divided by 100. */
export const norm100 = (v: unknown): number | null => { const n = numOrNull(v); return n == null ? null : Math.min(1, Math.max(0, n / 100)); };

/** Splits "A | B | C" (DataConnect's separator; "A > B" is accepted too) and makes sure the team itself is the last segment. */
export function teamPath(team: string, hierarchy: string): string[] {
  const h = hierarchy.trim();
  const parts = !h ? [] : h.includes("|") ? h.split("|") : h.includes(" > ") ? h.split(" > ") : [h];
  const segs = parts.map((s) => s.trim()).filter(Boolean);
  if (segs.at(-1) !== team) segs.push(team);
  return segs;
}

const FREQUENCY_LABEL: Record<number, string> = { 1: "< 10x / month", 2: "10\u201320x / month", 3: "20+ / month" };
const STATUS: Record<string, ProgressStatus> = { "not started": "notStarted", beginner: "beginner", intermediate: "intermediate", graduate: "graduate", expert: "expert" };
const SEGMENTS: Segment[] = ["Experts", "Graduated", "Intermediate", "Needs coaching", "Underconfident", "Overconfident", "Non-participants"];
const PLATFORMS: Platform[] = ["Desktop", "Mobile", "Tablet", "Unknown"];

export function assembleDashboard(clientId: string, clientName: string, rows: RowSet, asOf: string): DashboardData {
  // ---- teams ----
  const teams = new Map<string, TeamNode>();
  const teamMonths: TeamMonth[] = [];
  for (const r of rows.teamMonthly) {
    const team = str(r.team);
    if (!team) continue;
    const path = teamPath(team, str(r.team_hierarchy));
    let parent: string | null = null;
    for (let i = 0; i < path.length; i++) {
      const id: string = `${clientId}:${path.slice(0, i + 1).join(">")}`;
      if (!teams.has(id)) teams.set(id, { id, name: path[i], parentId: parent });
      parent = id;
    }
    teamMonths.push({
      teamId: parent as unknown as string, month: str(r.month), activeUsers: num(r.active_users), loggedInUsers: num(r.logged_in_users),
      trainingUsers: num(r.training_users), frequency: num(r.frequency), avgTimePerDayMin: num(r.avg_time_per_day_min),
    });
  }

  // ---- topics ----
  const topics: TopicNode[] = [];
  const topicStats: TopicStat[] = [];
  const categories = new Map<string, string>();
  for (const r of rows.topics) {
    const category = str(r.category) || "Uncategorised";
    let parentId = categories.get(category);
    if (!parentId) {
      parentId = `${clientId}:cat:${category}`;
      categories.set(category, parentId);
      topics.push({ id: parentId, name: category, parentId: null, subject: category });
    }
    const id = str(r.topic_key);
    topics.push({ id, name: str(r.topic_name), parentId, subject: str(r.subject) || "Unassigned" });
    topicStats.push({
      topicId: id, baseline: norm01(r.avg_baseline), current: norm01(r.avg_current), audience: num(r.audience),
      completion: norm01(r.completion) ?? 0, targetGroups: num(r.target_groups), modules: num(r.modules),
      l1: num(r.l1), l2: num(r.l2), l3: num(r.l3), createdAt: str(r.created_at),
    });
  }

  const k = rows.knowledgeAccount[0];
  const knowledge = {
    baseline: norm01(k?.avg_baseline), current: norm01(k?.avg_current), confidence: norm100(k?.avg_confidence),
    experts: num(k?.expert_users), topicCompletion: norm01(k?.topic_completion),
  };

  const freqTotal = rows.frequency.reduce((s, r) => s + num(r.user_count), 0) || 1;
  const frequency: FrequencyBucket[] = [...rows.frequency].sort((a, b) => num(a.frequency_sort) - num(b.frequency_sort)).map((r) => {
    const cur = numOrNull(r.avg_current);
    const scale = cur != null && cur > 1 ? 100 : 1;
    const lift = numOrNull(r.avg_lift);
    return {
      bucket: FREQUENCY_LABEL[num(r.frequency_sort)] ?? "Other", userShare: num(r.user_count) / freqTotal,
      currentKnowledge: cur == null ? null : Math.min(1, cur / scale), knowledgeLift: lift == null ? null : lift / scale,
    };
  });

  // ---- progress by subject and level ----
  const byKey = new Map<string, SubjectProgress>();
  for (const r of rows.progress) {
    const level = num(r.question_level);
    const status = STATUS[str(r.status).toLowerCase()];
    if (!status || (level !== 1 && level !== 2 && level !== 3)) continue;
    const subject = str(r.subject) || "Unassigned";
    const key = `${subject}|${level}`;
    const entry = byKey.get(key) ?? { subject, level, counts: { notStarted: 0, beginner: 0, intermediate: 0, graduate: 0, expert: 0 } as ProgressCounts };
    entry.counts[status] += num(r.records);
    byKey.set(key, entry);
  }
  const progress = [...byKey.values()];
  const subjects = [...new Set([...topics.filter((t) => t.parentId).map((t) => t.subject), ...progress.map((p) => p.subject)])].sort();

  // ---- usage ----
  const usageMonthly: UsageMonth[] = rows.usageMonthly.map((r) => ({
    month: str(r.month), platformLogins: num(r.logins), trainingActivities: num(r.training_activities),
    trainingHours: num(r.training_seconds) / 3600, completedTraining: num(r.completed_training),
    gamesPlayed: num(r.games_played), pointsSpent: num(r.points_spent), broadcastsSent: num(r.broadcasts_sent),
  })).sort((a, b) => a.month.localeCompare(b.month));

  const platformAccess: PlatformAccess[] = rows.platformAccess
    .map((r) => ({ platform: (PLATFORMS.includes(str(r.platform_group) as Platform) ? str(r.platform_group) : "Unknown") as Platform, logins: num(r.logins) }))
    .filter((p) => p.logins > 0);

  const hourCounts = new Map(rows.hours.map((r) => [num(r.hour), num(r.activity_count)]));
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourCounts.get(hour) ?? 0 }));

  const features: FeatureUsage[] = [...rows.features].sort((a, b) => num(a.sort_order) - num(b.sort_order))
    .map((r) => ({ feature: str(r.feature), share: num(r.active_users) > 0 ? num(r.users) / num(r.active_users) : 0 }));

  const matrix: MatrixPoint[] = rows.matrix
    .filter((r) => SEGMENTS.includes(str(r.segment) as Segment))
    .map((r) => ({ segment: str(r.segment) as Segment, avgKnowledge: norm01(r.avg_knowledge) ?? 0, avgConfidence: norm100(r.avg_confidence) ?? 0, learners: num(r.learners) }));

  const groups: TrainingGroup[] = rows.deliveryGroups.map((r) => ({
    id: str(r.group_id), name: str(r.name), status: str(r.status).toLowerCase() === "active" ? "Active" : "Inactive",
    programs: num(r.programs), reinforcementTopics: num(r.reinforcement_topics),
  }));
  const d = rows.deliverySummary[0];

  const questionsAndModules = topicStats.reduce((s, t) => s + t.l1 + t.l2 + t.l3 + t.modules, 0);

  return {
    clientId, clientName, asOf, months: aggregateMonths(teamMonths, [...teams.values()]), teams: [...teams.values()], teamMonths, topics, topicStats, knowledge, frequency,
    content: { contentItems: questionsAndModules, trainingModules: topicStats.reduce((s, t) => s + t.modules, 0), lastUpdated: topicStats.map((t) => t.createdAt).filter(Boolean).sort().at(-1) ?? "" },
    subjects, progress, usageMonthly, platformAccess, hours, features, matrix, groups,
    delivery: { avgQuestionPool: num(d?.avg_question_pool), estimatedMonthsToGraduate: numOrNull(d?.months_to_graduate) },
  };
}
