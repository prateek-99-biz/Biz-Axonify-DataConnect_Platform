import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function PageHeader({ icon: Icon, title, subtitle, right }: { icon: LucideIcon; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-accent shadow-[0_10px_28px_-10px_rgb(var(--brand)/0.9)] ring-1 ring-white/60 dark:ring-white/10">
          <Icon className="h-6 w-6 text-navy" aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/**
 * Which time window a number covers. Dashboard pages mix date-range charts with snapshots and rolling windows, so
 * every KPI and card says which one it is.
 */
export const SCOPES = {
  range: { label: "Date range", help: "Follows the date range selected at the top of the page." },
  month: { label: "Latest month", help: "The most recent month in the selected range (rolling 30 days to the last data refresh when it is the current month)." },
  d30: { label: "Last 30 days", help: "Rolling 30 days to the last data refresh. Ignores the date range." },
  snapshot: { label: "Snapshot", help: "Current state at the last data refresh. Ignores the date range." },
} as const;
export type Scope = keyof typeof SCOPES;

export function ScopeTag({ scope, label }: { scope: Scope; label?: string }) {
  return (
    <span title={SCOPES[scope].help} className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-300">
      {label ?? SCOPES[scope].label}
    </span>
  );
}

export function KpiTile({ label, value, hint, scope, scopeLabel }: { label: string; value: string; hint?: string; scope?: Scope; scopeLabel?: string }) {
  return (
    <Card className="relative py-4 pl-6 pr-4" title={hint}>
      <span aria-hidden className="absolute bottom-4 left-3 top-4 w-1 rounded-full bg-gradient-to-b from-brand to-brand-accent" />
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400">{hint}</p>}
    </Card>
  );
}

export function KpiStrip({ children, cols = 5 }: { children: ReactNode; cols?: 3 | 4 | 5 | 6 | 8 }) {
  const map = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6", 8: "lg:grid-cols-4 xl:grid-cols-8" } as const;
  return <section className={cn("grid gap-4 sm:grid-cols-2", map[cols])}>{children}</section>;
}

/** In-cell bar for tables (value 0-1). */
export function DataBar({ value, label }: { value: number | null; label?: string }) {
  if (value == null) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-accent" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">{label ?? `${(value * 100).toFixed(0)}%`}</span>
    </div>
  );
}

const STATUS_STYLE = {
  High: "bg-brand", Medium: "bg-amber-400", Low: "bg-red-600",
} as const;

export function StatusDot({ status }: { status: "High" | "Medium" | "Low" | null }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <span className="inline-flex items-center gap-2 font-medium"><span className={cn("h-2.5 w-2.5 rounded-full", STATUS_STYLE[status])} aria-hidden />{status}</span>;
}

export function TrendPill({ trend }: { trend: "Rising" | "Declining" | "Stable" | "No prior data" }) {
  const tone = trend === "Rising" ? "bg-brand/15 text-brand-ink" : trend === "Declining" ? "bg-critical/10 text-critical" : "bg-slate-100 text-slate-600";
  const arrow = trend === "Rising" ? "▲ " : trend === "Declining" ? "▼ " : trend === "Stable" ? "– " : "";
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", tone)}>{arrow}{trend}</span>;
}

export function InternalNote({ children }: { children: ReactNode }) {
  return (
    <p className="glass !rounded-xl border-dashed px-4 py-2 text-xs text-slate-500">
      <span className="mr-2 rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-white/15">Internal</span>
      {children}
    </p>
  );
}
