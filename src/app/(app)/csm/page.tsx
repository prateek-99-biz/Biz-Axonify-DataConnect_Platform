import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { loadContext, type SearchParams } from "@/server/services/context";
import { buildPortfolio } from "@/server/services/portfolio";
import { accountSignals } from "@/server/services/account-signals";
import { bookSummary, buildAccountCards, csmKey, csmKeyForEmail, weekAgenda, type AccountCard } from "@/server/services/accounts";
import { sampleCount } from "@/server/services/salesforce-accounts";
import { periodKey, periodLabel } from "@/server/metrics/period";
import { Badge, Button, Card, CardHeader, EmptyState, Select, SourceUnavailable } from "@/components/ui/primitives";
import { KpiStrip } from "@/components/ui/kpi";
import { RiskBadge } from "@/components/ui/risk-badge";
import { Sparkline } from "@/components/charts/sparkline";
import { RenewalTimeline } from "@/components/internal/renewal-timeline";
import { PeriodNotice } from "@/components/internal/period-notice";
import { SampleNotice } from "@/components/internal/sample-notice";
import { cn, fmtNumber, fmtPct, fmtHealth } from "@/lib/utils";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)}`;

function AccountCardView({ c, period }: { c: AccountCard; period: string }) {
  const tone = c.risk === "critical" ? "critical" : c.risk === "at_risk" ? "warn" : c.risk === "healthy" ? "good" : "neutral";
  return (
    <Link href={`/clients/${c.clientId}?period=${period}`} className="group block">
      <Card className="h-full p-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 truncate text-lg font-semibold group-hover:text-brand-ink">{c.name}</p>
          {c.noData ? <Badge>No Data This Quarter</Badge> : (
            <span className="flex shrink-0 items-center gap-2"><RiskBadge risk={c.risk} /><span className="text-2xl font-semibold tabular-nums">{fmtHealth(c.health)}</span></span>
          )}
        </div>

        {!c.noData && (
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <div>
              <Sparkline values={c.spark} tone={tone} label={`Participation over the last ${c.spark.length} quarters for ${c.name}`} />
              <p className="mt-1 text-[11px] text-slate-500">Participation, last {c.spark.length} quarters</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold tabular-nums">{fmtPct(c.participation)}</p>
              {c.participationDeltaPts != null && <p className={cn("text-[11px] tabular-nums", c.participationDeltaPts <= -3 ? "text-critical" : "text-slate-500")}>{signed(c.participationDeltaPts)} pts</p>}
            </div>
          </div>
        )}

        {!c.noData && (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-brand/10 px-2.5 py-1.5"><dt className="text-slate-500">Knowledge</dt><dd className="font-semibold tabular-nums">{fmtPct(c.knowledge)}</dd></div>
            <div className="rounded-lg bg-brand/10 px-2.5 py-1.5"><dt className="text-slate-500">Registered Users</dt><dd className="font-semibold tabular-nums">{fmtNumber(c.users ?? 0)}</dd></div>
          </dl>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.renewalDays != null && c.renewalDays <= 365 && <Badge tone={c.renewalDays <= 30 ? "warn" : "neutral"}>Renews in {c.renewalDays} day{c.renewalDays === 1 ? "" : "s"}</Badge>}
          {c.dataCheck && <Badge tone="warn" title="Only a few registered users are active. Check Axonify before acting.">Check Data</Badge>}
          {c.openTasks > 0 && <Badge tone={c.overdueTasks > 0 ? "critical" : "neutral"}>{c.openTasks} open task{c.openTasks === 1 ? "" : "s"}{c.overdueTasks > 0 ? `, ${c.overdueTasks} overdue` : ""}</Badge>}
          {!c.noData && (c.daysSinceNote == null ? <Badge>No notes yet</Badge> : c.daysSinceNote >= 30 ? <Badge tone="warn">No note for {c.daysSinceNote} days</Badge> : null)}
        </div>
      </Card>
    </Link>
  );
}

export default async function MyAccountsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("dashboard:internal");
  const sp = await searchParams;
  const loaded = await loadContext(sp);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx } = loaded;
  const period = periodKey(ctx.filters.period);
  const isAdmin = can(user.role, "settings:manage");
  const sample = await sampleCount();

  // Every CSM that has accounts, by name.
  const books = new Map<string, { key: string; name: string; count: number }>();
  for (const c of ctx.clients) {
    const key = csmKey(c);
    if (key === "") continue;
    const b = books.get(key) ?? { key, name: c.csmName || key, count: 0 };
    b.count++;
    books.set(key, b);
  }
  const list = [...books.values()].sort((a, b) => a.name.localeCompare(b.name));

  if (list.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">My Accounts</h1>
        <Card className="border-dashed">
          <EmptyState title="No CSM data loaded yet">
            CSM names, renewal dates and licences come from the Salesforce account data.
            {isAdmin ? " Import the file, or load sample data to see how the page looks, from Settings." : " An administrator can import it from Settings."}
          </EmptyState>
          {isAdmin && <p className="pb-6 text-center text-xs"><Link href="/settings" className="underline">Open Settings</Link></p>}
        </Card>
      </div>
    );
  }

  const mine = csmKeyForEmail(user.email, ctx.clients);
  const wanted = one(sp.csm);
  const selected = list.find((b) => b.key === wanted)?.key ?? mine ?? list[0].key;
  const isMine = selected === mine;
  const who = list.find((b) => b.key === selected)!;
  const book = ctx.clients.filter((c) => csmKey(c) === selected);

  const today = new Date().toISOString().slice(0, 10);
  const signals = await accountSignals(book.map((c) => c.id), today);
  const cards = buildAccountCards(book, ctx.rows, ctx.filters.period, signals, today, ctx.filters.inProgress);
  const summary = bookSummary(cards);
  const agenda = weekAgenda(cards, today);
  const users = cards.reduce((n, c) => n + (c.users ?? 0), 0);

  // The manager's view of every CSM, kept small and for admins only.
  const all = isAdmin ? buildPortfolio(ctx.clients, ctx.rows, { client: null, industry: null, period: ctx.filters.period }) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isMine ? "My Accounts" : `${who.name}’s Accounts`}<Badge tone="biz" className="ml-3 align-middle">Internal Only</Badge></h1>
          <p className="mt-1 text-sm text-slate-500">{who.name} · {summary.accounts} account{summary.accounts === 1 ? "" : "s"} · {fmtNumber(users)} users · {periodLabel(ctx.filters.period)}</p>
        </div>
        {list.length > 1 && (
          <form method="get" className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <input type="hidden" name="period" value={period} />
            <label className="flex items-center gap-2">Viewing
              <Select name="csm" defaultValue={selected} aria-label="Customer success manager">
                {list.map((b) => <option key={b.key} value={b.key}>{b.name}{b.key === mine ? " (you)" : ""}</option>)}
              </Select>
            </label>
            <Button size="sm">Show</Button>
          </form>
        )}
      </div>

      <PeriodNotice label={periodLabel(ctx.filters.period)} progress={ctx.progress} asOf={ctx.asOf} />
      <SampleNotice count={sample} canRemove={isAdmin} />

      <KpiStrip items={[
        { label: "Accounts", value: String(summary.accounts) },
        { label: "Need Attention", value: String(summary.needAttention) },
        { label: "Renewing In 90 Days", value: String(summary.renewing90) },
        { label: "Open Tasks", value: summary.overdueTasks > 0 ? `${summary.openTasks} (${summary.overdueTasks} overdue)` : String(summary.openTasks) },
      ]} />

      <Card>
        <CardHeader title="This Week" subtitle="Overdue and due tasks, renewals within 30 days, and accounts that have gone quiet" />
        {agenda.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">Nothing urgent. No overdue tasks, no renewals within 30 days, and every account has a recent note.</p>
        ) : (
          <ul className="divide-y divide-line">
            {agenda.map((a) => (
              <li key={a.key}>
                <Link href={`/clients/${a.clientId}?period=${period}&tab=activity`} className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-brand/10">
                  <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", a.urgent ? "bg-critical" : "bg-slate-400")} />
                  <span className="min-w-0 flex-1"><span className="font-semibold">{a.name}</span> <span className="text-slate-600">· {a.text}</span></span>
                  <span className="text-xs text-slate-500">Open notes and tasks</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Renewal Timeline" subtitle="Next twelve months, coloured by account health" />
        <div className="px-5 py-4">
          {cards.some((c) => c.renewalDate) ? (
            <RenewalTimeline today={today} items={cards.filter((c) => c.renewalDate).map((c) => ({ id: c.clientId, name: c.name, days: c.renewalDays ?? -1, risk: c.risk }))} />
          ) : <p className="text-sm text-slate-600">No renewal dates for these accounts yet. They come from the Salesforce file.</p>}
        </div>
      </Card>

      <section aria-label="Accounts" className="grid gap-4 lg:grid-cols-2">
        {cards.map((c) => <AccountCardView key={c.clientId} c={c} period={period} />)}
      </section>

      {all && (
        <details className="glass !rounded-2xl">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">Team View: every CSM</summary>
          <div className="overflow-x-auto border-t hairline">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-5 py-2.5 font-semibold">CSM</th><th className="px-3 py-2.5 text-right font-semibold">Accounts</th><th className="px-3 py-2.5 text-right font-semibold">Need Attention</th><th className="px-3 py-2.5 text-right font-semibold">Average Health</th><th className="px-5 py-2.5 font-semibold"><span className="sr-only">Open</span></th></tr>
              </thead>
              <tbody>
                {all.csmBooks.filter((b) => b.csmEmail !== "").map((b) => (
                  <tr key={b.csmEmail} className="border-t hairline">
                    <td className="px-5 py-2.5 font-semibold">{b.csmName}{b.csmEmail === mine ? " (you)" : ""}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{b.clients}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{b.atRisk}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtHealth(b.current.healthScore)}</td>
                    <td className="px-5 py-2.5 text-right"><Link href={`/csm?csm=${encodeURIComponent(b.csmEmail)}&period=${period}`} className="text-xs underline">View accounts</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
