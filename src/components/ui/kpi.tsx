import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "./primitives";
import { cn, fmtNumber, fmtPct } from "@/lib/utils";
import type { Delta } from "@/server/metrics/calculations";

export function DeltaChip({ d, unit = "pts", invert = false }: { d: Delta; unit?: "pts" | "pct" | "abs"; invert?: boolean }) {
  if (d.abs == null) return <span className="text-xs text-slate-400">n/a</span>;
  const val = unit === "pts" ? d.abs * 100 : unit === "abs" ? d.abs : d.pct != null ? d.pct * 100 : null;
  if (val == null) return <span className="text-xs text-slate-400">n/a</span>;
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
  label, value, vsPrev, vsYear, hint, unit = "pts",
}: { label: string; value: string; vsPrev?: Delta; vsYear?: Delta; hint?: string; unit?: "pts" | "pct" | "abs" }) {
  return (
    <Card className="group relative p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift" title={hint}>
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-brand/25 blur-2xl transition-opacity group-hover:opacity-80 dark:bg-brand/15" />
      <p className="relative text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="relative mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="relative mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
      <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-medium text-slate-500">
        {vsPrev && <span className="flex items-center gap-1.5">vs prev <DeltaChip d={vsPrev} unit={unit} /></span>}
        {vsYear && <span className="flex items-center gap-1.5">YoY <DeltaChip d={vsYear} unit={unit} /></span>}
      </div>
    </Card>
  );
}

export const pct = fmtPct;
export const num = fmtNumber;
