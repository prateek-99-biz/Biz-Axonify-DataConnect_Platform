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
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", flat ? "text-slate-500" : good ? "text-[#3d7a1c]" : "text-critical")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {val > 0 ? "+" : ""}{val.toFixed(1)}{unit === "pct" ? "%" : " pts"}
    </span>
  );
}

export function KpiCard({
  label, value, vsPrev, vsYear, hint, unit = "pts",
}: { label: string; value: string; vsPrev?: Delta; vsYear?: Delta; hint?: string; unit?: "pts" | "pct" | "abs" }) {
  return (
    <Card className="p-4" title={hint}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
        {vsPrev && <span className="flex items-center gap-1">vs prev <DeltaChip d={vsPrev} unit={unit} /></span>}
        {vsYear && <span className="flex items-center gap-1">YoY <DeltaChip d={vsYear} unit={unit} /></span>}
      </div>
    </Card>
  );
}

export const pct = fmtPct;
export const num = fmtNumber;
