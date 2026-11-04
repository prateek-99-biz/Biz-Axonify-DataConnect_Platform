import { cn } from "@/lib/utils";

const TONE = { critical: "text-critical", warn: "text-warn", good: "text-brand", neutral: "text-slate-400" } as const;

/** A small trend line on a fixed 0 to 100% scale, so two accounts' lines can be compared by eye. Gaps in the data break the line. */
export function Sparkline({ values, tone = "neutral", label, className }: { values: (number | null)[]; tone?: keyof typeof TONE; label: string; className?: string }) {
  const W = 120, H = 32, PAD = 3;
  const n = values.length;
  const x = (i: number) => (n <= 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1));
  const y = (v: number) => H - PAD - Math.max(0, Math.min(1, v)) * (H - PAD * 2);

  const segments: [number, number][][] = [];
  let run: [number, number][] = [];
  values.forEach((v, i) => {
    if (v == null) { if (run.length) segments.push(run); run = []; }
    else run.push([x(i), y(v)]);
  });
  if (run.length) segments.push(run);
  const last = [...values].map((v, i) => ({ v, i })).filter((p) => p.v != null).pop();

  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className={cn("h-8 w-full", TONE[tone], className)} preserveAspectRatio="none">
      <line x1="0" x2={W} y1={H - PAD} y2={H - PAD} stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {segments.filter((s) => s.length > 1).map((s, i) => (
        <polyline key={i} points={s.map(([px, py]) => `${px},${py}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
      {last && last.v != null && <circle cx={x(last.i)} cy={y(last.v)} r="2.6" fill="currentColor" />}
    </svg>
  );
}
