import type { ClientRowView } from "./portfolio";
import type { RiskLevel } from "@/server/metrics/calculations";
import { riskLabel } from "@/lib/labels";

/** A renewal this close is worth saying out loud next to a client that is already struggling. */
export const RENEWAL_WINDOW_DAYS = 120;

export interface AttentionItem {
  clientId: string;
  name: string;
  risk: RiskLevel;
  health: number | null;
  /** What moved, in one phrase: the participation drop, or the factor that moved health most. */
  change: string | null;
  renewalDate: string | null;
  renewalDays: number | null;
}

export interface Attention {
  /** Clients that are Critical or At Risk. A participation drop alone is counted in `declining`, so the headline number stays a short list. */
  total: number;
  critical: number;
  atRisk: number;
  declining: number;
  items: AttentionItem[];
}

export const daysUntil = (iso: string, today: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);

const signed = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}`;

const rank = (r: RiskLevel) => (r === "critical" ? 0 : r === "at_risk" ? 1 : 2);

/** The one phrase that explains a client's row. A real participation drop comes first, because it is the thing a CSM can act on. */
function changePhrase(c: ClientRowView, prevLabel: string): string | null {
  if (c.declining && c.participationDelta.abs != null) return `Participation ${signed(c.participationDelta.abs * 100)} pts vs ${prevLabel}`;
  if (c.topFactor && Math.abs(c.topFactor.points) >= 0.05) return `${c.topFactor.label} ${signed(c.topFactor.points)} health pts vs ${prevLabel}`;
  return null;
}

/** Orders the clients that need attention: Critical, then At Risk, then declining ones, lowest health first within each. */
export function buildAttention(clients: ClientRowView[], today: string, prevLabel: string, limit = 6): Attention {
  const flagged = clients.filter((c) => c.risk === "critical" || c.risk === "at_risk" || c.declining);
  const ordered = [...flagged].sort((a, b) => rank(a.risk) - rank(b.risk) || (a.current.healthScore ?? Infinity) - (b.current.healthScore ?? Infinity) || a.client.name.localeCompare(b.client.name));
  return {
    total: flagged.filter((c) => c.risk === "critical" || c.risk === "at_risk").length,
    critical: flagged.filter((c) => c.risk === "critical").length,
    atRisk: flagged.filter((c) => c.risk === "at_risk").length,
    declining: flagged.filter((c) => c.declining).length,
    items: ordered.slice(0, limit).map((c) => {
      const renewalDate = c.client.commercial?.renewalDate ?? null;
      const days = renewalDate ? daysUntil(renewalDate, today) : null;
      return {
        clientId: c.client.id, name: c.client.name, risk: c.risk, health: c.current.healthScore, change: changePhrase(c, prevLabel),
        renewalDate, renewalDays: days != null && days >= 0 && days <= RENEWAL_WINDOW_DAYS ? days : null,
      };
    }),
  };
}

export interface ClientHeadline {
  tone: "good" | "neutral" | "warn" | "critical";
  headline: string;
  points: string[];
}

/** The sentence a client page opens with: how the client is doing, what moved most, and any renewal coming up. */
export function buildClientHeadline(i: {
  risk: RiskLevel; health: number | null; healthDeltaPts: number | null; prevLabel: string;
  factor: { label: string; points: number } | null; participationPts: number | null; declining: boolean;
  renewalDate: string | null; today: string;
}): ClientHeadline {
  const tone = i.risk === "healthy" ? "good" : i.risk === "at_risk" ? "warn" : i.risk === "critical" ? "critical" : "neutral";
  const points: string[] = [];

  if (i.risk === "unknown" || i.health == null) {
    points.push("Health needs both participation and knowledge, and one of them is missing for this quarter.");
    return { tone: "neutral", headline: "Not enough data to score this client's health", points };
  }

  const h = Math.round(i.health);
  const move = i.healthDeltaPts == null ? "" : Math.abs(i.healthDeltaPts) < 0.5 ? `, unchanged from ${i.prevLabel}` : `, ${i.healthDeltaPts > 0 ? "up" : "down"} ${Math.abs(i.healthDeltaPts).toFixed(0)} pts from ${i.prevLabel}`;
  const headline = `${riskLabel(i.risk)}: health is ${h}${move}`;

  if (i.declining && i.participationPts != null) points.push(`Participation fell ${Math.abs(i.participationPts).toFixed(1)} pts against ${i.prevLabel}.`);
  if (i.factor && Math.abs(i.factor.points) >= 0.05) points.push(`${i.factor.label} moved health most (${signed(i.factor.points)} pts).`);
  if (i.renewalDate) {
    const days = daysUntil(i.renewalDate, i.today);
    points.push(days < 0 ? `The renewal date (${i.renewalDate}) has passed.` : `Renews on ${i.renewalDate}, in ${days} day${days === 1 ? "" : "s"}.`);
  }
  return { tone, headline, points };
}
