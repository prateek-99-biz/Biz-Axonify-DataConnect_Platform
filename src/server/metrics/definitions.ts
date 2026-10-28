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
    name: "Registered users",
    description: "Users registered in the client's Axonify tenant at the end of the period.",
    formula: "count(users registered at period end)",
    unit: "count",
    status: "provisional",
  },
  {
    key: "active_users",
    name: "Active users",
    description: "Distinct users whose account is active in the period (Axonify's 'Employees' in the Participation report). This is not a count of users who logged in, so it stays close to registered users.",
    formula: "count(distinct users with an active account in period)",
    unit: "count",
    status: "provisional",
  },
  {
    key: "engagement_rate",
    name: "Engagement rate",
    description: "Share of registered users with an active account in the period. Because active means an active account, this is close to 100% and says little; treat it as low-signal until a login-based or license-based version exists. Not a report measure.",
    formula: "active_users / registered_users",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "training_users",
    name: "Training users",
    description: "Active users with at least one training session in the period.",
    formula: "count(active users with ≥1 training session in period)",
    unit: "count",
    status: "approved",
  },
  {
    key: "participation_rate",
    name: "Participation",
    description: "Share of active users that trained in the period (report: Team Participation).",
    formula: "training_users / active_users",
    unit: "ratio",
    status: "approved",
  },
  {
    key: "avg_knowledge",
    name: "Current knowledge",
    description: "Average current score across every active user-topic-level record with a score, on a 0-1 scale. Same method as Axonify's Knowledge Summary report.",
    formula: "avg(current_score) over user-topic-level rows; values above 1 are divided by 100",
    unit: "ratio",
    status: "approved",
  },
  {
    key: "retention_rate",
    name: "Retention rate",
    description: "Share of the previous period's active users who were active again this period.",
    formula: "retained_users / previous_active_users",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "feature_adoption",
    name: "Feature adoption",
    description: "Share of features available to the client that were used in the period.",
    formula: "features_used / features_available",
    unit: "ratio",
    status: "provisional",
  },
  {
    key: "health_score",
    name: "Client health score",
    description: "Equal-weight composite of participation and knowledge (0–100), as in the Power BI report (Account Health Score).",
    formula: "100 × (0.5·participation + 0.5·knowledge)",
    unit: "score",
    status: "approved",
  },
];

export const HEALTH_WEIGHTS = { participation: 0.5, knowledge: 0.5 } as const;

/** Health bands from the report (Health Band): at least 75 Healthy, 60 Moderate, 45 At risk, otherwise Critical. */
export const RISK_THRESHOLDS = { healthy: 75, moderate: 60, atRisk: 45 } as const;
