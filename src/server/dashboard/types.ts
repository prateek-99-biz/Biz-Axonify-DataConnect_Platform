/**
 * Data contracts for the Axonify Data Connect dashboard (QBR + internal views).
 * Shapes mirror the Power BI report's fact tables so a BigQuery adapter can fill them later.
 * Ratios are 0-1; months are "YYYY-MM"; user counts are distinct users.
 */

export type ProgressStatus = "notStarted" | "beginner" | "intermediate" | "graduate" | "expert";
export type ProgressCounts = Record<ProgressStatus, number>;

export interface MonthEngagement {
  month: string;
  activeUsers: number;
  loggedInUsers: number;
  trainingUsers: number;
  /** Sessions per active user per month (account-level, user-weighted). */
  frequency: number;
  avgTimePerDayMin: number;
}

export interface TeamNode { id: string; name: string; parentId: string | null }

export interface TeamMonth {
  teamId: string;
  month: string;
  activeUsers: number;
  loggedInUsers: number;
  trainingUsers: number;
  frequency: number;
  avgTimePerDayMin: number;
}

export interface TopicNode { id: string; name: string; parentId: string | null; subject: string }

export interface TopicStat {
  topicId: string;
  /** Null when no learner has a score for the topic yet. */
  baseline: number | null;
  current: number | null;
  audience: number;
  completion: number;
  targetGroups: number;
  modules: number;
  l1: number;
  l2: number;
  l3: number;
  createdAt: string;
}

export interface KnowledgeSummary {
  baseline: number | null;
  current: number | null;
  confidence: number | null;
  experts: number;
  topicCompletion: number | null;
}

export interface FrequencyBucket { bucket: string; userShare: number; currentKnowledge: number | null; knowledgeLift: number | null }

export interface ContentSummary { contentItems: number; trainingModules: number; lastUpdated: string }

export interface SubjectProgress { subject: string; level: 1 | 2 | 3; counts: ProgressCounts }

export interface UsageSummary { trainingHours: number; platformLogins: number; trainingActivities: number; gamesPlayed: number; pointsSpent: number; broadcastsSent: number }
/** Monthly usage totals; the page sums the months in the selected range. */
export interface UsageMonth extends UsageSummary { month: string; completedTraining: number }
export type Platform = "Desktop" | "Mobile" | "Tablet" | "Unknown";
/** Logins in the last 30 days by device group. */
export interface PlatformAccess { platform: Platform; logins: number }
/** Training activity in the last 30 days by hour of day (the source has no platform split). */
export interface HourCount { hour: number; count: number }
export interface FeatureUsage { feature: string; share: number }

export type Segment = "Experts" | "Graduated" | "Intermediate" | "Needs coaching" | "Underconfident" | "Overconfident" | "Non-participants";
export interface MatrixPoint { segment: Segment; avgKnowledge: number; avgConfidence: number; learners: number }

export interface TrainingGroup { id: string; name: string; status: "Active" | "Inactive"; programs: number; reinforcementTopics: number }
export interface DeliverySummary { avgQuestionPool: number; estimatedMonthsToGraduate: number | null }

export interface DashboardData {
  clientId: string;
  clientName: string;
  /** ISO timestamp of the last data refresh shown in the footer. */
  asOf: string;
  months: MonthEngagement[];
  teams: TeamNode[];
  teamMonths: TeamMonth[];
  topics: TopicNode[];
  topicStats: TopicStat[];
  knowledge: KnowledgeSummary;
  frequency: FrequencyBucket[];
  content: ContentSummary;
  subjects: string[];
  progress: SubjectProgress[];
  usageMonthly: UsageMonth[];
  platformAccess: PlatformAccess[];
  hours: HourCount[];
  features: FeatureUsage[];
  matrix: MatrixPoint[];
  groups: TrainingGroup[];
  delivery: DeliverySummary;
}
