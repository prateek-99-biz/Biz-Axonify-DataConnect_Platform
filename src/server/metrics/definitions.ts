/**
 * Shared metric definitions. Participation, knowledge, health score and its bands mirror the Axonify CSM
 * Power BI report (measures noted per entry) and are marked approved. Engagement rate, retention and feature
 * adoption are not in the report and stay provisional. Definitions are surfaced in the UI (Data Reliability →
 * Metric definitions) and seeded into Postgres (MetricDefinition).
 */
export interface MetricDefinition {
  key: string;
  name: string;
  description: string;
  formula: string;
  unit: "ratio" | "count" | "score";
  status: "provisional" | "approved";
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    key: "registered_users",
    name: "Registered Users",
    description: "Users registered in the client's Axonify tenant at any point in the period, including people who left during it, so that everyone counted as active is also counted as registered.",
    formula: "Users on the books at any point in the period",
    unit: "count",
    status: "provisional",
  },
  {
    key: "active_users",
    name: "Active Users",
    description: "Distinct users whose account is active in the period (Axonify's 'Employees' in the Participation report with All Users selected; the client dashboards and the In Training Programs switch count only people in active training programs). This is not a count of users who logged in, so it stays close to registered users.",
    formula: "Distinct users with an active account in the period",
    unit: "count",
    status: "provisional",
  },
  {
    key: "engagement_rate",
    name: "Active Accounts",
    description: "Share of registered users with an active account in the period (shown as Active Accounts). Because active means an active account, this is close to 100% and says little; treat it as low-signal. It is not the Engagement on the Insights pages, which is people who logged in ÷ active users (Engagement (Logged In) below). Not a report measure.",
    formula: "Active users ÷ registered users",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "training_users",
    name: "Training Users",
    description: "Active users with at least one training session in the period.",
    formula: "Active users with at least 1 training session in the period",
    unit: "count",
    status: "approved",
  },
  {
    key: "participation_rate",
    name: "Participation",
    description: "Share of active users who completed training, in an average month. This is Axonify's 'Average Training Participation' (Reports, Participation) with All Users selected, and matches it month by month; the client dashboards match its default Users in Active Training Programs view instead. Counting anyone who trained once in the quarter reads much higher, so that is used only for quarters before November 2024, which have no monthly data.",
    formula: "Users with a training session in the month ÷ active users, summed over the months of the period",
    unit: "ratio",
    status: "approved",
  },
  {
    key: "avg_knowledge",
    name: "Current Knowledge",
    description: "Average current score across every active user-topic-level record with a score, on a 0-1 scale. Same method as Axonify's Knowledge Summary report.",
    formula: "Average current score over all user, topic and level records; scores above 1 are divided by 100",
    unit: "ratio",
    status: "approved",
  },
  {
    key: "retention_rate",
    name: "Retention Rate",
    description: "Share of the previous period's active users who were active again this period.",
    formula: "Retained users ÷ previous active users",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "feature_adoption",
    name: "Feature Adoption",
    description: "Share of the 12 Axonify features the platform can see in DataConnect (training, Max, broadcasts, chat, communities, knowledge base, games, rewards, recognition, tasks, forms, events) that at least 1% of the client's active users used in an average month. One person trying a feature (an admin testing chat) does not count.",
    formula: "Features used by at least 1% of active users in an average month ÷ 12",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "login_engagement",
    name: "Engagement (Logged In)",
    description: "Share of active users who logged in, in an average month. This is Axonify's 'Average Participation' and is the Engagement shown on the Insights pages and the Client Leaderboard.",
    formula: "Users with at least one session in the month ÷ active users, summed over the months of the period",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "max_adoption",
    name: "Max Adoption",
    description: "Share of active users who asked Max, Axonify's AI assistant, at least one question in an average month.",
    formula: "People who asked Max in the month ÷ active users, summed over the months of the period",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "max_per_100",
    name: "Max Questions per 100 Users",
    description: "How much a client uses Max, scaled to its size so a large and a small client compare fairly. Ranks Most AI Use on the leaderboard.",
    formula: "100 × Max questions ÷ active users, summed over the months of the period",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "max_grounded",
    name: "Max Answers From Client Content",
    description: "Share of Max answers that cited at least one page, topic, training module or file from the client's own Axonify content.",
    formula: "Questions with a response source ÷ all questions",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "max_helpful",
    name: "Max Rated Helpful",
    description: "Of the Max answers people rated, the share not rated negatively. Hidden below 10 ratings. DataConnect records thumbs-up, or thumbs-down with an optional reason (incorrect, confusing, irrelevant).",
    formula: "1 − negative ratings ÷ all ratings",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "licence_use",
    name: "Licence Use",
    description: "Average monthly active users against the licences in the Salesforce file. Under 50% marks a contract as Under-Used on Cost to Serve.",
    formula: "Average active users per month ÷ licences",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "health_score",
    name: "Client Health Score",
    description: "Equal-weight composite of participation and knowledge (0–100), as in the Power BI report (Account Health Score).",
    formula: "100 × (50% participation + 50% knowledge)",
    unit: "score",
    status: "approved",
  },
];

export const HEALTH_WEIGHTS = { participation: 0.5, knowledge: 0.5 } as const;

/** Health bands from the report (Health Band): at least 75 Healthy, 60 Moderate, 45 At risk, otherwise Critical. */
export const RISK_THRESHOLDS = { healthy: 75, moderate: 60, atRisk: 45 } as const;
