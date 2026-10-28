import { Badge } from "./primitives";
import type { RiskLevel } from "@/server/metrics/calculations";

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const map = {
    healthy: { tone: "good", label: "Healthy" },
    moderate: { tone: "neutral", label: "Moderate" },
    at_risk: { tone: "warn", label: "At risk" },
    critical: { tone: "critical", label: "Critical" },
    unknown: { tone: "neutral", label: "No data" },
  } as const;
  const m = map[risk];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
