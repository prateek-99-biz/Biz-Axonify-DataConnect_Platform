import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { RiskBadge } from "@/components/ui/risk-badge";
import type { Attention } from "@/server/services/attention";

/** The first thing on the Portfolio page: how many clients need a conversation, which ones, and why. */
export function NeedsAttention({ attention, scopeCount, periodLabel, periodKey }: { attention: Attention; scopeCount: number; periodLabel: string; periodKey: string }) {
  const { total, critical, atRisk, declining, items } = attention;

  if (total === 0 && declining === 0) {
    return (
      <Card className="relative p-5">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-brand/25 blur-3xl dark:bg-brand/15" />
        <div className="relative flex items-center gap-3">
          <CircleCheck className="h-9 w-9 shrink-0 text-brand-ink" aria-hidden />
          <div>
            <p className="text-lg font-semibold">All {scopeCount} clients are on track</p>
            <p className="text-sm text-slate-600">None is Critical, At Risk or losing participation in {periodLabel}.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative">
      <div aria-hidden className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-critical/15 blur-3xl dark:bg-critical/10" />
      <div className="relative grid lg:grid-cols-[17rem_1fr]">
        <div className="border-b hairline p-5 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Needs Attention</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-semibold tabular-nums tracking-tight">{total}</span>
            <span className="text-sm text-slate-600">{total === 0 ? "clients Critical or At Risk" : `of ${scopeCount} clients`}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">in {periodLabel}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {critical > 0 && <Badge tone="critical">{critical} Critical</Badge>}
            {atRisk > 0 && <Badge tone="warn">{atRisk} At Risk</Badge>}
            {declining > 0 && <Badge tone="neutral" title="Participation fell 3 points or more against the previous quarter">{declining} Losing Participation</Badge>}
          </div>
        </div>

        <div>
          <ul className="divide-y divide-line">
            {items.map((c) => (
              <li key={c.clientId}>
                <Link href={`/clients/${c.clientId}?period=${periodKey}`} className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-brand/10">
                  <span className="min-w-0 flex-1 basis-40 truncate font-semibold group-hover:text-brand-ink">{c.name}</span>
                  {c.risk !== "unknown" && c.health != null && (
                    <span className="flex items-center gap-2">
                      <RiskBadge risk={c.risk} />
                      <span className="w-7 text-right text-sm font-semibold tabular-nums">{c.health.toFixed(0)}</span>
                    </span>
                  )}
                  <span className="min-w-0 flex-1 basis-48 text-xs text-slate-600">{c.change ?? ""}</span>
                  {c.renewalDays != null && <Badge tone="warn" title={`Renewal date ${c.renewalDate}`}>Renews in {c.renewalDays} day{c.renewalDays === 1 ? "" : "s"}</Badge>}
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <p className="border-t hairline px-5 py-2.5 text-xs text-slate-500">
            {total > items.length ? `Showing the ${items.length} lowest of ${total}. ` : ""}
            <Link href={`/clients?period=${periodKey}`} className="underline">See every client</Link>
          </p>
        </div>
      </div>
    </Card>
  );
}
