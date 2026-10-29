import { Badge } from "./primitives";
import type { RiskLevel } from "@/server/metrics/calculations";
import { riskLabel } from "@/lib/labels";

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const map = {
    healthy: { tone: "good" },
    moderate: { tone: "neutral" },
    at_risk: { tone: "warn" },
    critical: { tone: "critical" },
    unknown: { tone: "neutral" },
  } as const;
  const m = map[risk];
  return <Badge tone={m.tone}>{riskLabel(risk)}</Badge>;
}
