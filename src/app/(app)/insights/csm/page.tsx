import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import type { SearchParams } from "@/server/services/context";
import { loadInsights } from "@/server/services/insights-context";
import { renewalRisk, type ClientInsight, type RenewalRisk } from "@/server/services/insights";
import { buildRenewals, csmKey } from "@/server/services/accounts";
import { touchpoints } from "@/server/services/account-signals";
import { sampleCount } from "@/server/services/salesforce-accounts";
import { ratio } from "@/server/metrics/calculations";
import { periodKey, periodLabel } from "@/server/metrics/period";
import { Badge, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { RiskBadge } from "@/components/ui/risk-badge";
import { CompareBars } from "@/components/charts/charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { PeriodNotice } from "@/components/internal/period-notice";
import { SampleNotice } from "@/components/internal/sample-notice";
import { InsightsHeader, PlainSummary, Stat, UsageNotice } from "@/components/insights/ui";
import { CountingBar } from "@/components/insights/basis";
import { cn, fmtHealth, fmtNumber, fmtPct } from "@/lib/utils";
import { riskLabel } from "@/lib/labels";

const RENEWAL_TONE: Record<RenewalRisk, "critical" | "warn" | "good" | "neutral"> = { High: "critical", Medium: "warn", Low: "good", Unknown: "neutral" };
const TOUCH_DAYS = 90;
/** Adds a full stop unless the sentence already ends with one (names such as "Sarah K." do). */
const endSentence = (s: string) => (s.endsWith(".") ? s : `${s}.`);
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

interface Book {
  key: string; name: string; email: string; accounts: ClientInsight[];
  users: number; participation: number | null; knowledge: number | null; health: number | null; engagement: number | null; maxAdoption: number | null;
  healthy: number; atRisk: number; touches: number;
}

export default async function CsmPortfolioPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("dashboard:internal");
  const loaded = await loadInsights(await searchParams);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx, insights, usageReason } = loaded;
  const period = periodKey(ctx.filters.period);
  const label = periodLabel(ctx.filters.period);
  const today = new Date().toISOString().slice(0, 10);
  const isAdmin = can(user.role, "settings:manage");
  const sample = await sampleCount();

  const assigned = insights.clients.filter((c) => csmKey(c.client) !== "");
  if (assigned.length === 0) {
    return (
      <div className="space-y-4">
        <InsightsHeader title="CSM Portfolio" subtitle="Every CSM's book of business side by side." />
        <Card className="border-dashed"><EmptyState title="No CSM data loaded yet">CSM names come from the Salesforce account file. {isAdmin ? <Link href="/settings" className="underline">Import it in Settings</Link> : "An administrator can import it in Settings."}</EmptyState></Card>
      </div>
    );
  }

  const since = new Date(Date.now() - TOUCH_DAYS * 86_400_000).toISOString();
  const touches = await touchpoints(assigned.map((c) => c.client.id), since);
  const portfolioBooks = new Map(insights.portfolio.csmBooks.map((b) => [b.csmEmail, b]));

  const keys = [...new Set(assigned.map((c) => csmKey(c.client)))];
  const books: Book[] = keys.map((key) => {
    const accounts = assigned.filter((c) => csmKey(c.client) === key);
    const pb = portfolioBooks.get(key);
    const sum = (f: (c: ClientInsight) => number) => accounts.reduce((s, c) => s + f(c), 0);
    const active = sum((c) => c.usage.activeUsers);
    return {
      key, name: accounts[0].client.csmName || key, email: accounts[0].client.csmEmail, accounts,
      users: pb?.current.registeredUsers ?? 0,
      participation: pb?.current.participationRate ?? null, knowledge: pb?.current.avgKnowledge ?? null, health: pb?.current.healthScore ?? null,
      engagement: ratio(sum((c) => c.usage.loggedInUsers), active), maxAdoption: ratio(sum((c) => c.usage.maxUsers), active),
      healthy: accounts.filter((c) => c.risk === "healthy").length, atRisk: accounts.filter((c) => c.risk === "at_risk" || c.risk === "critical").length,
      touches: sum((c) => (touches.get(c.client.id)?.notes ?? 0) + (touches.get(c.client.id)?.tasks ?? 0)),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const chart = books.map((b) => ({ csm: b.name, participation: b.participation, knowledge: b.knowledge, ...(insights.hasUsage ? { engagement: b.engagement } : {}) }));
  const bestPart = [...books].filter((b) => b.participation != null).sort((a, b) => b.participation! - a.participation!)[0];
  const mostRisk = [...books].sort((a, b) => b.atRisk - a.atRisk)[0];
  const quiet = books.filter((b) => b.touches === 0);

  const renewals = buildRenewals(ctx.clients, insights.portfolio.clients, today, 365);
  const renewalRows: TableRow[] = renewals.map((r) => {
    const rr = renewalRisk(r.risk, r.days);
    return {
      id: r.clientId, href: `/clients/${r.clientId}?period=${period}`,
      cells: {
        account: { v: r.name }, csm: { v: r.csm }, date: { v: r.date }, days: { v: r.days, node: `${r.days} days` },
        value: { v: r.value, node: r.value == null ? "—" : `${r.currency} ${fmtNumber(r.value)}` },
        health: { v: riskLabel(r.risk), node: <RiskBadge risk={r.risk} /> },
        risk: { v: rr, node: <Badge tone={RENEWAL_TONE[rr]}>{rr}</Badge> },
      },
    };
  });

  const summary = [
    `${books.length} CSM${books.length === 1 ? "" : "s"} look after ${assigned.length} account${assigned.length === 1 ? "" : "s"}${insights.clients.length > assigned.length ? `; ${insights.clients.length - assigned.length} account${insights.clients.length - assigned.length === 1 ? " has" : "s have"} no CSM on file` : ""}.`,
    bestPart && books.length > 1 ? `${bestPart.name}'s book has the best participation (${fmtPct(bestPart.participation)}).` : "",
    mostRisk && mostRisk.atRisk > 0 ? `${mostRisk.name} has the most accounts needing attention: ${mostRisk.atRisk} At Risk or Critical.` : "No CSM has an account in the At Risk or Critical bands.",
    quiet.length ? endSentence(`No notes or tasks logged in the last ${TOUCH_DAYS} days for ${quiet.map((b) => b.name).join(", ")}`) : "",
  ];

  return (
    <div className="space-y-6">
      <InsightsHeader title="CSM Portfolio" subtitle={`Each CSM's book of business in ${label}: how their accounts are doing, and which renewals are coming up.`} />
      <PeriodNotice label={label} progress={ctx.progress} asOf={ctx.asOf} />
      <SampleNotice count={sample} canRemove={isAdmin} />
      <UsageNotice reason={usageReason} />
      <CountingBar basis={loaded.basis} available={loaded.programsAvailable} gaps={loaded.gaps} names={Object.fromEntries(ctx.clients.map((c) => [c.id, c.name]))} />
      <PlainSummary points={summary} />

      {/* Four books fill one row of four; otherwise rows of three, so no card is left alone on a row when it can be avoided. */}
      <section aria-label="CSM books" className={cn("grid gap-4 lg:grid-cols-2", books.length % 4 === 0 ? "xl:grid-cols-4" : "2xl:grid-cols-3")}>
        {books.map((b) => (
          <Card key={b.key} className="border-t-4 border-t-brand p-5">
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/20 text-base font-semibold text-brand-ink">{initials(b.name)}</span>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{b.name}</p>
                <p className="text-xs text-slate-500">{b.accounts.length} account{b.accounts.length === 1 ? "" : "s"} · {fmtNumber(b.users)} registered users</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Participation" value={fmtPct(b.participation)} />
              <Stat label="Knowledge" value={fmtPct(b.knowledge)} />
              <Stat label="Healthy" value={String(b.healthy)} tone="good" />
              <Stat label="At Risk or Critical" value={String(b.atRisk)} tone={b.atRisk > 0 ? "critical" : undefined} />
              {insights.hasUsage && <Stat label="Engagement" value={fmtPct(b.engagement)} />}
              {insights.hasUsage && <Stat label="Max Adoption" value={fmtPct(b.maxAdoption)} />}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Average health {fmtHealth(b.health)} · {b.touches} touchpoint{b.touches === 1 ? "" : "s"} (notes and tasks) in {TOUCH_DAYS} days ·{" "}
              <Link href={`/csm?csm=${encodeURIComponent(b.key)}&period=${period}`} className="whitespace-nowrap underline">Open accounts</Link>
            </p>
          </Card>
        ))}
      </section>
      <p className="-mt-3 text-xs text-slate-500">
        Rates are for all users across a CSM&rsquo;s accounts together, so a large account weighs more than a small one. CSM ownership comes from the Salesforce file. Meetings and emails will show once the live Salesforce connection exists; until then, notes and tasks written here are the effort signal.
      </p>

      <Card>
        <CardHeader title="CSM Performance" subtitle={`Participation, knowledge${insights.hasUsage ? " and engagement" : ""} of each CSM's accounts in ${label}`} />
        <div className="p-4"><CompareBars data={chart} xKey="csm" series={[{ key: "participation", label: "Participation" }, { key: "knowledge", label: "Knowledge" }, ...(insights.hasUsage ? [{ key: "engagement", label: "Engagement" }] : [])]} /></div>
      </Card>

      <Card>
        <CardHeader title="Upcoming Renewals" subtitle="The next twelve months, soonest first. Renewal risk combines the health band with how soon the contract renews." />
        {renewalRows.length === 0 ? <EmptyState title="No renewals in the next twelve months">Renewal dates come from the Salesforce file.</EmptyState> : (
          <DataTable searchable={false} canExport={can(user.role, "export:csv")} exportName={`csm-renewals-${period}`} rows={renewalRows}
            columns={[{ key: "account", header: "Account" }, { key: "csm", header: "CSM" }, { key: "date", header: "Renewal" }, { key: "days", header: "In", align: "right" }, { key: "value", header: "Value", align: "right" }, { key: "health", header: "Health" }, { key: "risk", header: "Renewal Risk" }]} />
        )}
      </Card>
    </div>
  );
}
