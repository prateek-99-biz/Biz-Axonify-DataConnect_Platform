/**
 * Shared metric definitions. ALL are PROVISIONAL: formulas and thresholds below were
 * chosen to make the mock slice computable and have not been agreed with Biz Group or
 * validated against DataConnect. They are surfaced in the UI (Data Reliability →
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
    description: "Distinct users with at least one recorded session in the period.",
    formula: "count(distinct users with ≥1 session in period)",
    unit: "count",
    status: "provisional",
  },
  {
    key: "engagement_rate",
    name: "Engagement rate",
    description: "Share of registered users that were active in the period.",
    formula: "active_users / registered_users",
    unit: "ratio",
    status: "provisional",
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
    description: "Weighted composite of engagement, retention and adoption (0–100). Weights are placeholders.",
    formula: "100 × (0.5·engagement + 0.3·retention + 0.2·adoption)",
    unit: "score",
    status: "provisional",
  },
];

export const HEALTH_WEIGHTS = { engagement: 0.5, retention: 0.3, adoption: 0.2 } as const;

/** Provisional risk bands on the health score. */
export const RISK_THRESHOLDS = { critical: 40, warning: 60 } as const;
