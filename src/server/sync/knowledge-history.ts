/**
 * Axonify keeps each learner's current score per topic, not the score they had at the end of an earlier quarter, so
 * BigQuery can only give knowledge for the latest quarter. Each sync rewrites every client-period row from BigQuery,
 * which would erase the knowledge recorded for quarters that have since ended. This carries it forward instead: the
 * last value captured while a quarter was the latest one becomes that quarter's knowledge (and so its health score).
 */
export interface KnowledgeFields {
  clientId: string;
  period: string;
  knowledgeLearners: number;
  avgKnowledge: number | null;
}

const hasKnowledge = (r: Pick<KnowledgeFields, "avgKnowledge" | "knowledgeLearners">) => r.avgKnowledge != null && r.knowledgeLearners > 0;

/**
 * Returns the fresh rows with knowledge filled in from `saved` wherever the fresh row has none. A fresh value always
 * wins (the latest quarter is refreshed on every sync); saved values for periods that no longer appear are not brought back.
 */
export function carryKnowledge<T extends KnowledgeFields>(fresh: T[], saved: KnowledgeFields[]): { rows: T[]; carried: number } {
  const byKey = new Map(saved.filter(hasKnowledge).map((s) => [`${s.clientId}|${s.period}`, s]));
  let carried = 0;
  const rows = fresh.map((r) => {
    if (hasKnowledge(r)) return r;
    const old = byKey.get(`${r.clientId}|${r.period}`);
    if (!old) return r;
    carried++;
    return { ...r, knowledgeLearners: old.knowledgeLearners, avgKnowledge: old.avgKnowledge };
  });
  return { rows, carried };
}

/** The earliest period (e.g. "2026-Q4") that has knowledge, or null when none does. Period keys sort as text. */
export function firstKnowledgePeriod(rows: KnowledgeFields[]): string | null {
  const periods = rows.filter(hasKnowledge).map((r) => r.period).sort();
  return periods[0] ?? null;
}
