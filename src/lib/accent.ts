import type { KpiMetric } from "@/server/dashboard/definitions";

/**
 * One colour language for the whole platform. Axonify green leads and marks participation and people. Biz Group purple marks
 * learning and knowledge, and anything that is internal to the Biz team. Biz Group orange marks frequency and engagement.
 * A measure keeps its colour on every KPI tile and every chart, so a reader learns it once.
 *
 * Orange is for dots, bars and glows only: on a light surface it is too pale to carry text.
 */
export type Accent = "green" | "purple" | "orange";

// Full class names are written out so Tailwind can see them.
export const ACCENT: Record<Accent, { orb: string; dot: string; bar: string }> = {
  green: { orb: "bg-brand/25 dark:bg-brand/15", dot: "bg-brand", bar: "from-brand to-brand-accent" },
  purple: { orb: "bg-biz-purple/20 dark:bg-biz-purple/20", dot: "bg-biz-purple", bar: "from-biz-purple to-biz-purple/50" },
  orange: { orb: "bg-biz-orange/20 dark:bg-biz-orange/15", dot: "bg-biz-orange", bar: "from-biz-orange to-biz-orange/50" },
};

const BY_METRIC: Record<string, Accent> = { participation: "green", health: "green", knowledge: "purple", engagement: "orange" };

/** The accent for a measure on the team pages: participation, health, knowledge or engagement. Anything else is green. */
export const accentFor = (metric?: string): Accent => (metric && BY_METRIC[metric]) || "green";

const KNOWLEDGE_KPIS: ReadonlySet<KpiMetric> = new Set<KpiMetric>([
  "currentKnowledge", "baselineKnowledge", "lift", "confidence", "experts", "topicCompletion", "graduateExpert", "notStarted", "questionPool", "monthsToGraduate",
]);
const INTENSITY_KPIS: ReadonlySet<KpiMetric> = new Set<KpiMetric>(["frequency", "time"]);

/** The accent for a client-dashboard KPI tile: learning measures purple, usage intensity orange, people and participation green. */
export function accentForKpi(metric?: KpiMetric): Accent {
  if (!metric) return "green";
  return KNOWLEDGE_KPIS.has(metric) ? "purple" : INTENSITY_KPIS.has(metric) ? "orange" : "green";
}
