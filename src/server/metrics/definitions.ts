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
    description: "Distinct users whose account is active in the period (Axonify's 'Employees' in the Participation report). This is not a count of users who logged in, so it stays close to registered users.",
    formula: "Distinct users with an active account in the period",
    unit: "count",
    status: "provisional",
  },
  {
    key: "engagement_rate",
    name: "Engagement Rate",
    description: "Share of registered users with an active account in the period. Because active means an active account, this is close to 100% and says little; treat it as low-signal until a login-based or license-based version exists. Not a report measure.",
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
    description: "Share of active users that trained in the period (report: Team Participation).",
    formula: "Training users ÷ active users",
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
    description: "Share of features available to the client that were used in the period.",
    formula: "Features used ÷ features available",
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
