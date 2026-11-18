import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import type { SearchParams } from "@/server/services/context";
import { loadInsights } from "@/server/services/insights-context";
import { valueStatus, type ClientInsight, type ValueStatus } from "@/server/services/insights";
import { touchpoints } from "@/server/services/account-signals";
import { sampleCount } from "@/server/services/salesforce-accounts";
import { periodKey, periodLabel } from "@/server/metrics/period";
import { Badge, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { RiskBadge } from "@/components/ui/risk-badge";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { PeriodNotice } from "@/components/internal/period-notice";
import { SampleNotice } from "@/components/internal/sample-notice";
import { InsightsHeader, MeterRow, PlainSummary, Stat, UsageNotice } from "@/components/insights/ui";
import { CountingBar } from "@/components/insights/basis";
import { cn, fmtNumber, fmtPct } from "@/lib/utils";
import { riskLabel } from "@/lib/labels";

const STATUS_TONE: Record<ValueStatus, "good" | "warn" | "critical" | "neutral"> = { "Good Value": "good", "Under-Used": "warn", "At Risk": "critical", Unknown: "neutral" };
const TOUCH_DAYS = 90;
// A non-breaking space keeps "USD 1,240" on one line in narrow table cells.
const money = (currency: string, v: number | null) => (v == null ? "—" : `${currency} ${fmtNumber(Math.round(v))}`);

export default async function CostToServePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("commercial:read");
  const loaded = await loadInsights(await searchParams);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx, insights, usageReason } = loaded;
  const period = periodKey(ctx.filters.period);
  const label = periodLabel(ctx.filters.period);
  const isAdmin = can(user.role, "settings:manage");
  const sample = await sampleCount();
  const header = <InsightsHeader title="Cost to Serve" subtitle={`What each contract is worth against how much it is used in ${label}, which value is at risk, and how much attention each account gets.`} />;

  const priced = insights.clients.filter((c) => c.client.commercial?.licenseValue != null);
  if (priced.length === 0) {
    return (
      <div className="space-y-4">{header}
        <Card className="border-dashed"><EmptyState title="No contract values loaded yet">Contract values and licences come from the Salesforce account file. {isAdmin ? <Link href="/settings" className="underline">Import it in Settings</Link> : "An administrator can import it in Settings."}</EmptyState></Card>
      </div>
    );
  }

  const since = new Date(Date.now() - TOUCH_DAYS * 86_400_000).toISOString();
  const touches = await touchpoints(priced.map((c) => c.client.id), since);
  const touchOf = (c: ClientInsight) => (touches.get(c.client.id)?.notes ?? 0) + (touches.get(c.client.id)?.tasks ?? 0);

  const value = (c: ClientInsight) => c.client.commercial!.licenseValue!;
  const cur = (c: ClientInsight) => c.client.commercial!.currency;
  const engaged = (c: ClientInsight) => (c.usage.months > 0 ? c.usage.loggedInUsers / c.usage.months : null);
  const perActive = (c: ClientInsight) => (c.usage.avgActiveUsers ? value(c) / c.usage.avgActiveUsers : null);
  const perEngaged = (c: ClientInsight) => { const e = engaged(c); return e ? value(c) / e : null; };
  const status = (c: ClientInsight) => valueStatus(c.licenceUse, c.risk);

  // Totals are kept apart per currency because the Salesforce file can hold more than one.
  const currencies = [...new Set(priced.map(cur))].sort();
  const totals = currencies.map((currency) => {
    const inCur = priced.filter((c) => cur(c) === currency);
    const sum = (f: (c: ClientInsight) => boolean) => inCur.filter(f).reduce((s, c) => s + value(c), 0);
    return { currency, total: sum(() => true), atRisk: sum((c) => status(c) === "At Risk"), underUsed: sum((c) => status(c) === "Under-Used"), count: inCur.length };
  });
  const main = [...totals].sort((a, b) => b.total - a.total)[0];
  // "USD 565,890 and AED 28,516": every currency that has some of the value, so a count of accounts never hides another currency.
  const byCurrency = (k: "atRisk" | "underUsed") => totals.filter((t) => t[k] > 0).sort((a, b) => b[k] - a[k]).map((t) => money(t.currency, t[k])).join(" and ");
  const otherCurrencies = (k: "atRisk" | "underUsed") => totals.filter((t) => t !== main && t[k] > 0).map((t) => money(t.currency, t[k])).join(", ");

  const byValue = [...priced].sort((a, b) => value(b) - value(a));
  const atRisk = byValue.filter((c) => status(c) === "At Risk");
  const underUsed = byValue.filter((c) => status(c) === "Under-Used");
  const priciest = [...priced].filter((c) => perEngaged(c) != null && cur(c) === main.currency).sort((a, b) => perEngaged(b)! - perEngaged(a)!)[0];
  const neglected = byValue.filter((c) => touchOf(c) === 0 && (status(c) === "At Risk" || status(c) === "Under-Used"));

  const summary = [
    `${priced.length} account${priced.length === 1 ? " has a" : "s have a"} contract value on file, worth ${totals.map((t) => money(t.currency, t.total)).join(" and ")} a year.`,
    atRisk.length ? `${byCurrency("atRisk")} sits with ${atRisk.length} account${atRisk.length === 1 ? "" : "s"} in the At Risk or Critical bands: ${atRisk.slice(0, 4).map((c) => c.client.name).join(", ")}${atRisk.length > 4 ? " and more" : ""}.` : "No contract value sits with an At Risk or Critical account.",
    underUsed.length ? `${underUsed.length} account${underUsed.length === 1 ? " uses" : "s use"} under half of the licences paid for (${underUsed.slice(0, 4).map((c) => `${c.client.name} ${fmtPct(c.licenceUse, 0)}`).join(", ")}). These are the adoption conversations to have before renewal.` : "",
    priciest ? `${priciest.client.name} has the highest cost per engaged user: ${money(main.currency, perEngaged(priciest))} a year for each person who logs in.` : "",
    neglected.length ? `No notes or tasks in ${TOUCH_DAYS} days for ${neglected.slice(0, 4).map((c) => c.client.name).join(", ")}, though they are At Risk or Under-Used.` : "",
  ];

  const rows: TableRow[] = byValue.map((c) => {
    const s = status(c);
    return {
      id: c.client.id, href: `/clients/${c.client.id}?period=${period}`,
      cells: {
        account: { v: c.client.name }, csm: { v: c.client.csmName || "Unassigned", node: <span className="whitespace-nowrap">{c.client.csmName || "Unassigned"}</span> },
        value: { v: value(c), node: money(cur(c), value(c)) },
        licences: { v: c.client.commercial?.licenses ?? null, node: fmtNumber(c.client.commercial?.licenses ?? null) },
        active: { v: c.usage.avgActiveUsers, node: fmtNumber(c.usage.avgActiveUsers) },
        use: { v: c.licenceUse, node: <span className={cn(c.licenceUse != null && c.licenceUse < 0.5 && "font-semibold text-critical")}>{fmtPct(c.licenceUse, 0)}</span> },
        perActive: { v: perActive(c), node: money(cur(c), perActive(c)) },
        perEngaged: { v: perEngaged(c), node: money(cur(c), perEngaged(c)) },
        touches: { v: touchOf(c) },
        health: { v: riskLabel(c.risk), node: <RiskBadge risk={c.risk} /> },
        status: { v: s, node: <Badge tone={STATUS_TONE[s]}>{s}</Badge> },
      },
    };
  });

  return (
    <div className="space-y-6">
      {header}
      <PeriodNotice label={label} progress={ctx.progress} asOf={ctx.asOf} />
      <SampleNotice count={sample} canRemove={isAdmin} />
      <UsageNotice reason={usageReason} />
      <CountingBar basis={loaded.basis} available={loaded.programsAvailable} gaps={loaded.gaps} names={Object.fromEntries(ctx.clients.map((c) => [c.id, c.name]))} />
      <PlainSummary points={summary} />

      <section aria-label="Contract value" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Annual Contract Value" value={money(main.currency, main.total)} note={`${main.count} account${main.count === 1 ? "" : "s"}${totals.length > 1 ? ` · plus ${totals.filter((t) => t !== main).map((t) => money(t.currency, t.total)).join(", ")}` : ""}`} />
        <Stat label="Value at Risk" value={money(main.currency, main.atRisk)} tone={main.atRisk > 0 ? "critical" : undefined} note={`At Risk or Critical accounts${otherCurrencies("atRisk") ? ` · plus ${otherCurrencies("atRisk")}` : ""}`} />
        <Stat label="Value Under-Used" value={money(main.currency, main.underUsed)} tone={main.underUsed > 0 ? "warn" : undefined} note={`Under half of licences in use${otherCurrencies("underUsed") ? ` · plus ${otherCurrencies("underUsed")}` : ""}`} />
        <Stat label={`Touchpoints, ${TOUCH_DAYS} Days`} value={fmtNumber(priced.reduce((s, c) => s + touchOf(c), 0))} note="Notes and tasks logged here" />
      </section>

      <Card>
        <CardHeader title="Account Economics" subtitle="Biggest contracts first. Cost per user is the yearly contract value divided by average monthly users." />
        <DataTable canExport={can(user.role, "export:csv")} exportName={`cost-to-serve-${period}`} rows={rows}
          columns={[
            { key: "account", header: "Account" }, { key: "csm", header: "CSM" }, { key: "value", header: "Contract Value", align: "right", hint: "Yearly licence value from the Salesforce file" },
            { key: "licences", header: "Licences", align: "right" }, { key: "active", header: "Active Users", align: "right", hint: "Average per month" },
            { key: "use", header: "Licence Use", align: "right", hint: "Average active users ÷ licences" },
            { key: "perActive", header: "Per Active User", align: "right" }, { key: "perEngaged", header: "Per Engaged User", align: "right", hint: "Per person who logs in" },
            { key: "touches", header: "Touchpoints", align: "right", hint: `Notes and tasks logged in the last ${TOUCH_DAYS} days` },
            { key: "health", header: "Health" }, { key: "status", header: "Status" },
          ]} />
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Licence Use" subtitle="Average active users ÷ licences paid for. Under 50% is flagged." />
          <div className="px-5 py-3">
            {[...priced].filter((c) => c.licenceUse != null).sort((a, b) => a.licenceUse! - b.licenceUse!).map((c) => (
              <MeterRow key={c.client.id} label={c.client.name} value={c.licenceUse} display={fmtPct(c.licenceUse, 0)} marker={0.5} markerLabel="50%" tone={c.licenceUse! < 0.5 ? "critical" : c.licenceUse! < 0.7 ? "orange" : "good"} note={money(cur(c), value(c))} />
            ))}
            {priced.every((c) => c.licenceUse == null) && <p className="py-4 text-sm text-slate-600">Licence counts are not in the Salesforce file yet{usageReason ? ", and monthly usage has not been synced" : ""}.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="What Is Not Here Yet" />
          <ul className="space-y-2 px-5 py-4 text-sm text-slate-600">
            <li><span className="font-medium text-ink">Gross profit.</span> Needs the cost of delivering each account (people, content, platform fees) from finance. Add a cost column to the Salesforce file and it can be shown next to contract value.</li>
            <li><span className="font-medium text-ink">Effort without timesheets.</span> Touchpoints count the notes and tasks the team writes here, with no hours to log. Meetings and emails will be added from Salesforce activity once the live connection exists.</li>
            <li><span className="font-medium text-ink">Technical support hours.</span> Would come from the support desk; a ticket count per account is enough to start.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
