import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { Badge, Button, CALLOUT_WARN, Card, Select } from "@/components/ui/primitives";
import { cn, fmtNumber, fmtPct } from "@/lib/utils";
import type { LeaderFormat } from "@/server/services/insights";

/** Page title with the Internal Only tag and a one-line description. */
export function InsightsHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}<Badge tone="biz" className="ml-3 align-middle">Internal Only</Badge></h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

/** The page's main points written as sentences, so a reader gets the story before the numbers. */
export function PlainSummary({ points, title = "In Plain Words" }: { points: (string | React.ReactNode)[]; title?: string }) {
  const shown = points.filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <Card className="border-l-4 border-l-brand p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><Lightbulb className="h-4 w-4 text-brand-ink" aria-hidden />{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
        {shown.map((p, i) => <li key={i} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /><span>{p}</span></li>)}
      </ul>
    </Card>
  );
}

/** Shown in place of feature and Max numbers when the monthly usage has not been synced. */
export function UsageNotice({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <p role="note" className={cn("glass !rounded-xl px-4 py-2.5 text-xs", CALLOUT_WARN)}>
      <span className="font-semibold">Feature and Max usage is not available yet.</span> {reason}
    </p>
  );
}

const TONES = { good: "bg-brand", warn: "bg-amber-500", critical: "bg-critical", purple: "bg-biz-purple", orange: "bg-biz-orange", blue: "bg-[#3B6FD8] dark:bg-[#8CB8FF]", muted: "bg-slate-400" } as const;
export type BarTone = keyof typeof TONES;

/** One labelled horizontal bar on a 0-100% track, with the value written beside it. An optional marker shows a benchmark. */
export function MeterRow({ label, value, display, tone = "good", marker, markerLabel, note, href }: {
  label: React.ReactNode; value: number | null; display?: string; tone?: BarTone; marker?: number | null; markerLabel?: string; note?: string; href?: string;
}) {
  const w = value == null ? 0 : Math.max(0, Math.min(1, value)) * 100;
  const name = href ? <Link href={href} className="hover:underline">{label}</Link> : label;
  return (
    <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4.5rem] items-center gap-3 py-1.5 text-sm sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_5rem]">
      <span className="min-w-0 truncate" title={typeof label === "string" ? label : undefined}>{name}{note && <span className="block truncate text-[11px] text-slate-500">{note}</span>}</span>
      <span className="relative h-2.5 rounded-full bg-slate-200/70 dark:bg-white/10" role="img" aria-label={`${typeof label === "string" ? label : "Value"}: ${display ?? fmtPct(value)}`}>
        <span className={cn("absolute inset-y-0 left-0 rounded-full", TONES[tone])} style={{ width: `${w}%` }} />
        {marker != null && <span title={markerLabel} className="absolute -top-1 h-[18px] w-0.5 rounded bg-ink/70" style={{ left: `calc(${Math.max(0, Math.min(1, marker)) * 100}% - 1px)` }} />}
      </span>
      <span className="text-right font-semibold tabular-nums">{display ?? fmtPct(value)}</span>
    </div>
  );
}

/** Gold, silver and bronze, then plain numbers. */
export function Medal({ rank }: { rank: number }) {
  const style = rank === 1 ? "bg-amber-400 text-amber-950" : rank === 2 ? "bg-slate-300 text-slate-800" : rank === 3 ? "bg-orange-300 text-orange-950" : "bg-slate-100 text-slate-600 dark:bg-white/10";
  return <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums", style)} aria-label={`Rank ${rank}`}>{rank}</span>;
}

/** A GET form that picks one client and keeps the period. */
export function ClientPicker({ clients, selected, period, name = "focus", label = "Client" }: { clients: { id: string; name: string }[]; selected: string | null; period: string; name?: string; label?: string }) {
  return (
    <form method="get" className="flex items-center gap-2 text-xs font-medium text-slate-500">
      <input type="hidden" name="period" value={period} />
      <label className="flex items-center gap-2">{label}
        <Select name={name} defaultValue={selected ?? ""} aria-label={label}>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </label>
      <Button size="sm">Show</Button>
    </form>
  );
}

/** Writes a leaderboard value in its unit. */
export function fmtLeader(v: number | null, f: LeaderFormat): string {
  if (v == null || !Number.isFinite(v)) return "—";
  switch (f) {
    case "pct": return fmtPct(v);
    case "pts": return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1)} pts`;
    case "growth": return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(0)}%`;
    case "hours": return `${v.toFixed(1)} h`;
    case "score": return String(Math.floor(v));
    case "decimal": return v.toFixed(1);
    case "count": return fmtNumber(v);
    case "number": return fmtNumber(v);
  }
}

/** A small stat: label over a big number, with an optional line under it. */
export function Stat({ label, value, note, tone }: { label: string; value: string; note?: React.ReactNode; tone?: "good" | "warn" | "critical" }) {
  return (
    <div className="rounded-xl bg-brand/10 px-3.5 py-2.5 dark:bg-white/5">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums tracking-tight", tone === "good" && "text-brand-ink", tone === "warn" && "text-warn", tone === "critical" && "text-critical")}>{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
    </div>
  );
}

/** Up or down arrow with a signed change, coloured by whether up is good. */
export function Change({ value, format = "pts" }: { value: number | null; format?: "pts" | "growth" }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-xs text-slate-400">no comparison</span>;
  const flat = Math.abs(value) < 0.0005;
  return (
    <span className={cn("text-xs font-semibold tabular-nums", flat ? "text-slate-500" : value > 0 ? "text-brand-ink" : "text-critical")}>
      {flat ? "no change" : `${value > 0 ? "▲" : "▼"} ${format === "pts" ? `${(Math.abs(value) * 100).toFixed(1)} pts` : `${(Math.abs(value) * 100).toFixed(0)}%`}`}
    </span>
  );
}
