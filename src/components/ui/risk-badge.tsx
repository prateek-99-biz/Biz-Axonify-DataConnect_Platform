import { Badge } from "./primitives";
import type { RiskLevel } from "@/server/metrics/calculations";

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const map = {
    healthy: { tone: "good", label: "Healthy" },
    warning: { tone: "warn", label: "Watch" },
    critical: { tone: "critical", label: "Critical" },
    unknown: { tone: "neutral", label: "No data" },
  } as const;
  const m = map[risk];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
