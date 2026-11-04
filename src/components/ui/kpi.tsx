import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "./primitives";
import { cn, fmtNumber, fmtPct } from "@/lib/utils";
import { ACCENT, type Accent } from "@/lib/accent";
import type { Delta } from "@/server/metrics/calculations";

export function DeltaChip({ d, unit = "pts", invert = false }: { d: Delta; unit?: "pts" | "pct" | "abs"; invert?: boolean }) {
  if (d.abs == null) return <span className="text-xs text-slate-400">N/A</span>;
  const val = unit === "pts" ? d.abs * 100 : unit === "abs" ? d.abs : d.pct != null ? d.pct * 100 : null;
  if (val == null) return <span className="text-xs text-slate-400">N/A</span>;
  const flat = Math.abs(val) < 0.05;
  const good = invert ? val < 0 : val > 0;
  const Icon = flat ? Minus : val > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
      flat ? "bg-slate-100 text-slate-600" : good ? "bg-brand/15 text-brand-ink" : "bg-critical/10 text-critical")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {val > 0 ? "+" : ""}{val.toFixed(1)}{unit === "pct" ? "%" : " pts"}
    </span>
  );
}

export function KpiCard({
  label, value, vsPrev, vsYear, hint, unit = "pts", accent,
}: { label: string; value: string; vsPrev?: Delta; vsYear?: Delta; hint?: string; unit?: "pts" | "pct" | "abs"; accent?: Accent }) {
  // A tile with no value and no comparison says nothing, so it is left out until there is data.
  if (value === "—") return null;
  vsPrev = vsPrev?.abs == null ? undefined : vsPrev;
  vsYear = vsYear?.abs == null ? undefined : vsYear;
  return (
    <Card className="group relative p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift" title={hint}>
      <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full blur-2xl transition-opacity group-hover:opacity-80", ACCENT[accent ?? "green"].orb)} />
      <p className="relative flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{accent && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", ACCENT[accent].dot)} />}{label}</p>
      <p className="relative mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="relative mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-medium text-slate-500">
        {vsPrev && <span className="flex items-center gap-1.5">vs prev <DeltaChip d={vsPrev} unit={unit} /></span>}
        {vsYear && <span className="flex items-center gap-1.5">YoY <DeltaChip d={vsYear} unit={unit} /></span>}
      </div>
    </Card>
  );
}

/** The supporting numbers in one quiet row, so the headline KPIs above it are the ones that catch the eye. */
export function KpiStrip({ items }: { items: { label: string; value: string; vsPrev?: Delta; unit?: "pts" | "pct" | "abs"; accent?: Accent; note?: string; noteHint?: string }[] }) {
  const shown = items.filter((i) => i.value !== "—");
  if (shown.length === 0) return null;
  return (
    <Card className="grid grid-cols-2 gap-y-1 py-2 lg:grid-cols-4">
      {shown.map((i) => (
        <div key={i.label} className="px-5 py-3 lg:border-l hairline lg:first:border-l-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{i.accent && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", ACCENT[i.accent].dot)} />}{i.label}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{i.value}</span>
            {i.vsPrev?.abs != null && <DeltaChip d={i.vsPrev} unit={i.unit} />}
          </p>
          {i.note && <p className="mt-0.5 text-[10px] text-slate-400" title={i.noteHint}>{i.note}</p>}
        </div>
      ))}
    </Card>
  );
}

export const pct = fmtPct;
export const num = fmtNumber;
