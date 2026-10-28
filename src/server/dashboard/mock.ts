/**
 * DEVELOPMENT-ONLY synthetic dashboard data, deterministic per client. None of it is real; the UI labels it MOCK DATA.
 */
import { MOCK_AS_OF, rng } from "@/server/data/adapters/mock";
import { weightedAvg } from "./calc";
import type {
  DashboardData, HourCount, MatrixPoint, MonthEngagement, Platform, PlatformAccess, ProgressCounts, SubjectProgress,
  TeamMonth, TeamNode, TopicNode, TopicStat, TrainingGroup, UsageMonth,
} from "./types";

const MONTHS = (() => {
  const out: string[] = [];
  for (let i = 0; i < 20; i++) {
    const idx = 2025 * 12 + 2 + i; // 2025-03 .. 2026-10
    out.push(`${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`);
  }
  return out;
})();

const TEAM_PARENTS = ["Contact Center", "Retail", "Corporate", "Operations", "Regions"];
const PLACES = [
  "Abu Dhabi", "Dubai", "Sharjah", "Abuja", "Accra", "Addis Ababa", "Abidjan", "Cairo", "Riyadh", "Doha", "Muscat", "Amman",
  "Beirut", "Nairobi", "Lagos", "Kuwait City", "Manama", "Casablanca", "Tunis", "Dakar", "Kampala", "Lusaka", "Harare", "Colombo",
  "Mumbai", "Delhi", "Karachi", "Dhaka", "Manila", "Bangkok", "Jakarta", "Singapore", "Sydney", "Perth", "London", "Paris",
];
const FUNCTIONS = ["Admin", "Sales", "Support", "Learning & Training", "Cyber Security", "Finance", "Quality", "Reservations"];
const SUBJECTS = ["Product Knowledge", "Compliance", "Customer Service", "Cybersecurity", "Safety", "Sales Skills", "Onboarding"];
const TOPIC_PARENTS = ["Product & Destination Contents", "Compliance & Policy", "Service Skills"];
const TOPIC_NAMES = [
  "Paid seating: types and pricing", "Baggage policy essentials", "Confidence to sell: reassure and guide", "Did you know: regional highlights",
  "Upgrade offers: when to suggest", "Lounge access rules", "Handling difficult conversations", "Phishing and social engineering",
  "Data protection basics", "Fire and evacuation drill", "Manual handling", "Cross-selling add-ons", "Welcome and orientation",
  "Complaint recovery", "Loyalty programme tiers", "Visa and documentation", "Seasonal roadshow briefing", "Revenue tool-kit walkthrough",
  "Accessibility and special assistance", "Onboarding: first week", "Escalation paths", "Fare rules and exceptions",
];
const GROUP_NAMES = ["Front line", "Managers", "New joiners", "Back office", "Trainers", "Compliance leads", "Night shift", "Remote agents"];

const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)];
const int = (r: () => number, a: number, b: number) => Math.round(a + r() * (b - a));
const num = (r: () => number, a: number, b: number) => a + r() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function mockDashboard(clientId: string, clientName: string): DashboardData {
  const r = rng(`dash-${clientId}`);

  // ---- Teams (hierarchy: parent groups -> leaf teams) and monthly engagement ----
  const teams: TeamNode[] = [];
  const teamMonths: TeamMonth[] = [];
  const parentCount = 3 + Math.floor(r() * 2);
  let placeIdx = int(r, 0, 6);
  TEAM_PARENTS.slice(0, parentCount).forEach((pname, pi) => {
    const pid = `${clientId}-g${pi}`;
    teams.push({ id: pid, name: pname, parentId: null });
    const leafCount = int(r, 5, 11);
    for (let li = 0; li < leafCount; li++) {
      const id = `${pid}-t${li}`;
      const name = pi === 4 || r() < 0.55 ? PLACES[placeIdx++ % PLACES.length] : pick(r, FUNCTIONS);
      teams.push({ id, name: teams.some((t) => t.parentId === pid && t.name === name) ? `${name} ${li + 1}` : name, parentId: pid });
      const size = int(r, 8, 420);
      const basePart = clamp(Math.pow(r(), 1.5) * 1.05, 0, 1);
      const baseFreq = clamp(basePart * 12 + num(r, -1.5, 2.5), 0, 14);
      const drift = num(r, -0.004, 0.006);
      const logged = num(r, 0.62, 0.95);
      const time = num(r, 6, 34);
      MONTHS.forEach((m, mi) => {
        const active = Math.max(0, Math.round(size * (1 + mi * 0.004) * num(r, 0.96, 1.04)));
        const part = clamp(basePart + drift * mi + num(r, -0.03, 0.03), 0, 1);
        teamMonths.push({
          teamId: id, month: m, activeUsers: active, loggedInUsers: Math.round(active * clamp(logged + num(r, -0.04, 0.04), 0, 1)),
          trainingUsers: Math.round(active * part), frequency: clamp(baseFreq + drift * 20 * mi + num(r, -0.5, 0.5), 0, 16),
          avgTimePerDayMin: clamp(time + num(r, -2, 2), 0, 60),
        });
      });
    }
  });

  const months: MonthEngagement[] = MONTHS.map((m) => {
    const rows = teamMonths.filter((t) => t.month === m);
    const active = rows.reduce((s, x) => s + x.activeUsers, 0);
    const w = (f: (x: TeamMonth) => number) => (active ? rows.reduce((s, x) => s + f(x) * x.activeUsers, 0) / active : 0);
    return {
      month: m, activeUsers: active, loggedInUsers: rows.reduce((s, x) => s + x.loggedInUsers, 0), trainingUsers: rows.reduce((s, x) => s + x.trainingUsers, 0),
      frequency: w((x) => x.frequency), avgTimePerDayMin: w((x) => x.avgTimePerDayMin),
    };
  });
  const latestActive = months.at(-1)?.activeUsers ?? 0;

  // ---- Topics ----
  const topics: TopicNode[] = [];
  const topicStats: TopicStat[] = [];
  TOPIC_PARENTS.forEach((pname, pi) => {
    const pid = `${clientId}-p${pi}`;
    topics.push({ id: pid, name: pname, parentId: null, subject: pname });
    const n = int(r, 7, 12);
    for (let i = 0; i < n; i++) {
      const id = `${pid}-t${i}`;
      const subject = SUBJECTS[(pi * 3 + i) % SUBJECTS.length];
      topics.push({ id, name: `${pick(r, TOPIC_NAMES)} ${i + 1}`, parentId: pid, subject });
      const baseline = num(r, 0.5, 0.82);
      const archetype = r();
      let l1: number, l2: number, l3: number, modules = int(r, 0, 3);
      if (archetype < 0.55) [l1, l2, l3] = [int(r, 4, 12), int(r, 4, 12), int(r, 3, 12)];
      else if (archetype < 0.63) [l1, l2, l3] = [int(r, 13, 30), 0, 0];
      else if (archetype < 0.78) [l1, l2, l3] = [int(r, 5, 12), int(r, 0, 10), 0];
      else if (archetype < 0.9) [l1, l2, l3] = [int(r, 13, 20), int(r, 5, 14), int(r, 4, 12)];
      else if (archetype < 0.95) { [l1, l2, l3] = [0, 0, 0]; modules = 0; }
      else { [l1, l2, l3] = [0, 0, 0]; modules = Math.max(1, modules); }
      topicStats.push({
        topicId: id, baseline, current: clamp(baseline + num(r, 0.02, 0.2), 0, 0.98), audience: int(r, 30, Math.max(60, latestActive * 0.6)),
        completion: num(r, 0.0, 0.35), targetGroups: r() < 0.08 ? 0 : int(r, 1, 24), modules, l1, l2, l3,
        createdAt: new Date(Date.UTC(2025, 10, 1) + Math.floor(r() * 330) * 86400000).toISOString().slice(0, 10),
      });
    }
  });

  const aud = topicStats.reduce((s, t) => s + t.audience, 0) || 1;
  const released = topicStats.reduce((s, t) => s + t.l1 + t.l2 + t.l3, 0);
  const modulesTotal = topicStats.reduce((s, t) => s + t.modules, 0);

  const shares = [num(r, 0.4, 0.55), num(r, 0.3, 0.4)];
  const frequency = [
    { bucket: "< 10x / month", userShare: shares[0], currentKnowledge: num(r, 0.78, 0.83), knowledgeLift: num(r, 0.08, 0.12) },
    { bucket: "10-20x / month", userShare: shares[1], currentKnowledge: num(r, 0.83, 0.86), knowledgeLift: num(r, 0.12, 0.16) },
    { bucket: "20+ / month", userShare: Math.max(0.02, 1 - shares[0] - shares[1]), currentKnowledge: num(r, 0.86, 0.9), knowledgeLift: num(r, 0.16, 0.21) },
  ];

  // ---- Progress by subject and question level ----
  const usedSubjects = [...new Set(topics.filter((t) => t.parentId).map((t) => t.subject))];
  const progress: SubjectProgress[] = usedSubjects.flatMap((subject) => {
    const weight = num(r, 0.4, 1.6);
    return ([1, 2, 3] as const).map((level) => {
      const total = Math.round(latestActive * 6 * weight * (level === 1 ? 1.2 : 0.95));
      const ns = level === 1 ? 0.5 : level === 2 ? 0.68 : 0.78;
      const rest = 1 - ns;
      const split = [num(r, 0.1, 0.2), num(r, 0.25, 0.4), num(r, 0.2, 0.3), num(r, 0.1, 0.2)];
      const sum = split.reduce((a, b) => a + b, 0);
      const counts: ProgressCounts = {
        notStarted: Math.round(total * ns),
        beginner: Math.round((total * rest * split[0]) / sum),
        intermediate: Math.round((total * rest * split[1]) / sum),
        graduate: Math.round((total * rest * split[2]) / sum),
        expert: Math.round((total * rest * split[3]) / sum),
      };
      return { subject, level, counts };
    });
  });

  // ---- Usage ----
  const platforms: Platform[] = ["Desktop", "Mobile", "Tablet"];
  const platformShare: Record<Platform, number> = { Desktop: num(r, 0.6, 0.75), Mobile: num(r, 0.22, 0.32), Tablet: 0.02, Unknown: 0 };
  const hours: HourCount[] = Array.from({ length: 24 }, (_, hour) => {
    const work = Math.exp(-Math.pow((hour - 10) / 3, 2)) + 0.7 * Math.exp(-Math.pow((hour - 17) / 2, 2));
    const spike = hour === 3 ? 1.4 : 0;
    return { hour, count: Math.round(latestActive * 0.9 * (0.05 + work + spike) * num(r, 0.9, 1.1)) };
  });
  const totalActivity = hours.reduce((s, h) => s + h.count, 0);
  const platformAccess: PlatformAccess[] = platforms.map((platform) => ({ platform, logins: Math.round(totalActivity * 7 * platformShare[platform]) }));
  const usageMonthly: UsageMonth[] = months.map((m) => ({
    month: m.month, platformLogins: Math.round(m.activeUsers * num(r, 6, 9)), trainingActivities: Math.round(m.activeUsers * num(r, 6, 9)),
    trainingHours: Math.round(m.activeUsers * num(r, 0.6, 1.1)), completedTraining: Math.round(m.activeUsers * num(r, 1, 3)),
    gamesPlayed: Math.round(m.activeUsers * num(r, 0.8, 1.6)), pointsSpent: int(r, 5, 60), broadcastsSent: int(r, 0, 4),
  }));
  const features = [
    { feature: "Daily training", share: num(r, 0.22, 0.34) }, { feature: "Broadcasts", share: num(r, 0.12, 0.22) },
    { feature: "Games", share: num(r, 0.08, 0.16) }, { feature: "Achievements", share: num(r, 0.05, 0.12) },
    { feature: "Rewards", share: num(r, 0.0, 0.03) },
  ];

  // ---- Matrix, delivery ----
  const matrix: MatrixPoint[] = [
    { segment: "Experts", avgKnowledge: num(r, 0.9, 0.96), avgConfidence: num(r, 0.8, 0.9), learners: int(r, 200, 600) },
    { segment: "Graduated", avgKnowledge: num(r, 0.82, 0.9), avgConfidence: num(r, 0.62, 0.75), learners: int(r, 300, 900) },
    { segment: "Intermediate", avgKnowledge: num(r, 0.6, 0.75), avgConfidence: num(r, 0.5, 0.62), learners: int(r, 900, 2200) },
    { segment: "Needs coaching", avgKnowledge: num(r, 0.3, 0.45), avgConfidence: num(r, 0.2, 0.4), learners: int(r, 100, 400) },
    { segment: "Underconfident", avgKnowledge: num(r, 0.65, 0.8), avgConfidence: num(r, 0.2, 0.4), learners: int(r, 100, 450) },
    { segment: "Overconfident", avgKnowledge: num(r, 0.25, 0.4), avgConfidence: num(r, 0.7, 0.85), learners: int(r, 20, 120) },
    { segment: "Non-participants", avgKnowledge: num(r, 0.4, 0.6), avgConfidence: num(r, 0.4, 0.6), learners: int(r, 200, 700) },
  ];
  const groups: TrainingGroup[] = Array.from({ length: int(r, 10, 22) }, (_, i) => ({
    id: `${clientId}-grp${i}`, name: `${pick(r, GROUP_NAMES)} - ${pick(r, PLACES)}`, status: r() < 0.9 ? "Active" : "Inactive",
    programs: r() < 0.25 ? 0 : int(r, 1, 6), reinforcementTopics: r() < 0.3 ? 0 : int(r, 1, 9),
  }));

  const knowledge = {
    baseline: weightedAvg(topicStats, (t) => t.baseline), current: weightedAvg(topicStats, (t) => t.current), confidence: num(r, 0.4, 0.58),
    experts: Math.round(matrix[0].learners), topicCompletion: weightedAvg(topicStats, (t) => t.completion),
  };

  return {
    clientId, clientName, asOf: MOCK_AS_OF, months, teams, teamMonths, topics, topicStats, knowledge, frequency,
    content: { contentItems: released + modulesTotal, trainingModules: modulesTotal, lastUpdated: topicStats.map((t) => t.createdAt).sort().at(-1) ?? "" },
    subjects: usedSubjects, progress, usageMonthly, platformAccess, hours, features, matrix, groups,
    delivery: { avgQuestionPool: released / Math.max(1, topicStats.length) * 12, estimatedMonthsToGraduate: num(r, 9, 24) },
  };
}
