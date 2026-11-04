import type { RiskLevel } from "@/server/metrics/calculations";

export interface TimelineItem { id: string; name: string; days: number; risk: RiskLevel }

const FILL: Record<RiskLevel, string> = { critical: "fill-critical", at_risk: "fill-warn", moderate: "fill-slate-400", healthy: "fill-brand", unknown: "fill-slate-300" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SPAN_DAYS = 365;

/** Renewals over the next twelve months, each dot coloured by the account's health. Anything further out is counted, not drawn. */
export function RenewalTimeline({ items, today }: { items: TimelineItem[]; today: string }) {
  const W = 680, LEFT = 24, RIGHT = 24, AXIS = 62;
  const inside = items.filter((i) => i.days >= 0 && i.days <= SPAN_DAYS).sort((a, b) => a.days - b.days);
  const later = items.filter((i) => i.days > SPAN_DAYS).length;
  const x = (days: number) => LEFT + (days / SPAN_DAYS) * (W - LEFT - RIGHT);
  const start = new Date(`${today}T00:00:00Z`);
  const ticks = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k * 2, 1));
    return { label: MONTHS[d.getUTCMonth()], days: Math.round((d.getTime() - start.getTime()) / 86_400_000) };
  }).filter((t) => t.days >= 0 && t.days <= SPAN_DAYS);

  return (
    <div>
      <svg viewBox={`0 0 ${W} 112`} className="h-auto w-full" role="img" aria-label={`${inside.length} renewals in the next twelve months`}>
        <line x1={LEFT} x2={W - RIGHT} y1={AXIS} y2={AXIS} className="stroke-slate-300" strokeWidth="1" />
        {ticks.map((t) => (
          <g key={t.label + t.days}>
            <line x1={x(t.days)} x2={x(t.days)} y1={AXIS - 4} y2={AXIS + 4} className="stroke-slate-300" strokeWidth="1" />
            <text x={x(t.days)} y={AXIS + 20} textAnchor="middle" className="fill-slate-500" fontSize="11">{t.label}</text>
          </g>
        ))}
        <line x1={x(0)} x2={x(0)} y1={AXIS - 14} y2={AXIS + 14} className="stroke-brand" strokeWidth="2" />
        <text x={x(0) + 6} y={AXIS + 34} className="fill-slate-500" fontSize="11">Today</text>
        {inside.map((it, i) => {
          const above = i % 2 === 0;
          return (
            <g key={it.id}>
              <circle cx={x(it.days)} cy={AXIS} r="7" className={FILL[it.risk]} />
              <text x={x(it.days)} y={above ? AXIS - 16 : AXIS + 38} textAnchor="middle" className="fill-ink" fontSize="11">{it.name.length > 14 ? `${it.name.slice(0, 13)}…` : it.name}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        {([["healthy", "Healthy"], ["moderate", "Moderate"], ["at_risk", "At Risk"], ["critical", "Critical"]] as const).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5"><svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="5" className={FILL[k]} /></svg>{l}</span>
        ))}
        {later > 0 && <span>{later} more renew{later === 1 ? "s" : ""} after twelve months</span>}
      </p>
    </div>
  );
}
