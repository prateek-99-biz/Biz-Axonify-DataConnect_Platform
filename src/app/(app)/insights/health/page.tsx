import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import type { SearchParams } from "@/server/services/context";
import { loadInsights } from "@/server/services/insights-context";
import { healthyVsStruggling, renewalRisk, type ClientInsight, type RenewalRisk } from "@/server/services/insights";
import { daysUntil } from "@/server/services/attention";
import { lowActivity } from "@/server/metrics/calculations";
import { sampleCount } from "@/server/services/salesforce-accounts";
import { FEATURES } from "@/server/metrics/features";
import { HEALTH_WEIGHTS } from "@/server/metrics/definitions";
import { periodKey, periodLabel, previousPeriod, yearAgo } from "@/server/metrics/period";
import { Badge, Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { KpiStrip } from "@/components/ui/kpi";
import { RiskBadge } from "@/components/ui/risk-badge";
import { CompareBars } from "@/components/charts/charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { PeriodNotice } from "@/components/internal/period-notice";
import { SampleNotice } from "@/components/internal/sample-notice";
import { Change, ClientPicker, InsightsHeader, MeterRow, PlainSummary, Stat, UsageNotice } from "@/components/insights/ui";
import { CountingBar } from "@/components/insights/basis";
import { fmtHealth, fmtNumber, fmtPct } from "@/lib/utils";
import { riskLabel } from "@/lib/labels";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const RENEWAL_TONE: Record<RenewalRisk, "critical" | "warn" | "good" | "neutral"> = { High: "critical", Medium: "warn", Low: "good", Unknown: "neutral" };
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

export default async function AccountHealthPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("dashboard:internal");
  const sp = await searchParams;
  const loaded = await loadInsights(sp);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx, insights, usageReason } = loaded;
  const f = ctx.filters;
  const period = periodKey(f.period);
  const label = periodLabel(f.period);
  const prevLabel = periodLabel(previousPeriod(f.period));
  const yaLabel = periodLabel(yearAgo(f.period));
  const today = new Date().toISOString().slice(0, 10);
  const sample = await sampleCount();
  const { portfolio } = insights;

  const withData = insights.clients.filter((c) => c.view);
  if (withData.length === 0) {
    return <EmptyState title={`No data for ${label}`}>None of the clients have records for this period. Choose an earlier period.</EmptyState>;
  }

  // Clients a year ago, for the "how big is the client base" line the deck asked for.
  const clientsYearAgo = insights.clients.filter((c) => c.healthYearAgo.registeredUsers > 0).length;
  const rc = portfolio.riskCounts;
  const needAttention = rc.critical + rc.at_risk;
  const byHealth = [...withData].sort((a, b) => (a.health?.healthScore ?? Infinity) - (b.health?.healthScore ?? Infinity));
  // An account where almost nobody is active (the Check Data rule on My Accounts) is flagged, not chosen as "needs the most attention".
  const checkData = (c: ClientInsight) => !!c.health && lowActivity(c.health);
  const scored = byHealth.filter((c) => c.health?.healthScore != null && !checkData(c));
  const worst = scored[0];
  const best = scored.at(-1);
  const toCheck = withData.filter(checkData);
  const k = portfolio.kpis;
  const healthChange = k.current.healthScore != null && k.previous.healthScore != null ? k.current.healthScore - k.previous.healthScore : null;

  const focusId = one(sp.focus);
  const focus = withData.find((c) => c.client.id === focusId) ?? worst ?? withData[0];

  const renewalDays = (c: ClientInsight) => (c.client.commercial?.renewalDate ? daysUntil(c.client.commercial.renewalDate, today) : null);
  const healthKnown = k.current.healthScore != null;

  const summary = [
    `${withData.length} client${withData.length === 1 ? " has" : "s have"} data for ${label}.${healthKnown ? ` ${rc.healthy} Healthy, ${rc.moderate} Moderate, ${rc.at_risk} At Risk and ${rc.critical} Critical.` : " Health bands need knowledge scores, which this period does not have."}`,
    clientsYearAgo > 0 ? `The client base is ${withData.length} client${withData.length === 1 ? "" : "s"}, against ${clientsYearAgo} in ${yaLabel} (${withData.length - clientsYearAgo >= 0 ? "+" : "−"}${Math.abs(withData.length - clientsYearAgo)}).` : "",
    healthKnown ? `Average health is ${fmtHealth(k.current.healthScore)} out of 100${healthChange != null ? `, ${healthChange >= 0 ? "up" : "down"} ${Math.abs(healthChange).toFixed(1)} points on ${prevLabel}` : ""}.` : "",
    toCheck.length ? `Check the data for ${toCheck.map((c) => `${c.client.name} (${fmtNumber(c.health!.activeUsers)} active of ${fmtNumber(c.health!.registeredUsers)} registered)`).join(", ")}: so few people are active that the account may be winding down or its users moved. Its scores are left out of the line below.` : "",
    worst && healthKnown && worst !== best ? `${worst.client.name} needs the most attention (health ${fmtHealth(worst.health?.healthScore)}, participation ${fmtPct(worst.health?.participationRate)}); ${best?.client.name} is the healthiest (${fmtHealth(best?.health?.healthScore)}).` : "",
  ];

  // ---- Focus account ----
  const fh = focus.health;
  const fp = focus.view?.previous;
  const fDays = renewalDays(focus);
  const fRenewal = renewalRisk(focus.risk, fDays);
  // The last three months of the period, newest first, so last month reads against the month before.
  const monthRows = [...focus.monthsCovered].sort().slice(-3).reverse();

  // ---- All accounts table ----
  const rows: TableRow[] = byHealth.map((c) => {
    const d = renewalDays(c);
    const rr = renewalRisk(c.risk, d);
    return {
      id: c.client.id, href: `/insights/health?period=${period}&focus=${c.client.id}`,
      cells: {
        account: { v: c.client.name, node: checkData(c) ? <span>{c.client.name} <Badge tone="warn" title="Only a few registered users are active. Check Axonify before acting.">Check Data</Badge></span> : c.client.name }, csm: { v: c.client.csmName || "Unassigned" },
        licences: { v: c.client.commercial?.licenses ?? null, node: c.client.commercial?.licenses != null ? fmtNumber(c.client.commercial.licenses) : "—" },
        use: { v: c.licenceUse, node: fmtPct(c.licenceUse, 0) },
        participation: { v: c.health?.participationRate ?? null, node: fmtPct(c.health?.participationRate) },
        engagement: { v: c.usage.engagement, node: fmtPct(c.usage.engagement) },
        knowledge: { v: c.health?.avgKnowledge ?? null, node: fmtPct(c.health?.avgKnowledge) },
        health: { v: c.health?.healthScore ?? null, node: fmtHealth(c.health?.healthScore) },
        status: c.risk === "unknown" ? { v: null, node: <span className="text-xs text-slate-500">No score</span> } : { v: riskLabel(c.risk), node: <RiskBadge risk={c.risk} /> },
        renewal: { v: d, node: c.client.commercial?.renewalDate ? <span>{c.client.commercial.renewalDate} <Badge tone={RENEWAL_TONE[rr]}>{rr}</Badge></span> : "—" },
      },
    };
  });
  const showLicences = withData.some((c) => c.client.commercial?.licenses != null);
  const showRenewal = withData.some((c) => c.client.commercial?.renewalDate);

  const hvs = healthyVsStruggling(withData);
  const hvsData = hvs.rows.filter((r) => r.healthy != null || r.struggling != null).map((r) => ({ measure: r.measure, Healthy: r.healthy, Struggling: r.struggling }));

  const contribution = (v: number | null | undefined, w: number) => (v == null ? null : Math.min(1, Math.max(0, v)) * w * 100);

  return (
    <div className="space-y-6">
      <InsightsHeader title="Account Health" subtitle={`How healthy every account is in ${label}, what drives each score, and which renewals are at risk. Compared with ${prevLabel} and ${yaLabel}.`} />
      <PeriodNotice label={label} progress={ctx.progress} asOf={ctx.asOf} />
      <SampleNotice count={sample} canRemove={can(user.role, "settings:manage")} />
      <UsageNotice reason={usageReason} />
      <CountingBar basis={loaded.basis} available={loaded.programsAvailable} gaps={loaded.gaps} names={Object.fromEntries(ctx.clients.map((c) => [c.id, c.name]))} />
      <PlainSummary points={summary} />

      <KpiStrip items={[
        { label: "Clients", value: String(withData.length), note: clientsYearAgo ? `${clientsYearAgo} in ${yaLabel}` : undefined },
        { label: "Average Health", value: fmtHealth(k.current.healthScore) },
        { label: "Healthy or Moderate", value: healthKnown ? String(rc.healthy + rc.moderate) : "—" },
        { label: "Need Attention", value: healthKnown ? String(needAttention) : "—", note: "At Risk or Critical" },
      ]} />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b hairline px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Account in Focus</p>
            <h2 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold">{focus.client.name}{focus.risk === "unknown" ? <Badge title="Health needs knowledge scores, which this period does not have">No Health Score</Badge> : <RiskBadge risk={focus.risk} />}{checkData(focus) && <Badge tone="warn" title="Only a few registered users are active. Check Axonify before acting.">Check Data</Badge>}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              CSM {focus.client.csmName || "not recorded"}
              {focus.client.commercial?.renewalDate ? <> · renews {focus.client.commercial.renewalDate}{fDays != null && fDays >= 0 ? ` (in ${fDays} days)` : ""} · renewal risk <Badge tone={RENEWAL_TONE[fRenewal]}>{fRenewal}</Badge></> : " · no renewal date on file"}
              {" "}· <Link href={`/clients/${focus.client.id}?period=${period}`} className="underline">Open client profile</Link>
            </p>
          </div>
          <ClientPicker clients={[...withData].sort((a, b) => a.client.name.localeCompare(b.client.name)).map((c) => c.client)} selected={focus.client.id} period={period} label="Focus on" />
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label="Health Score" value={fmtHealth(fh?.healthScore)} note={<Change value={fh?.healthScore != null && fp?.healthScore != null ? (fh.healthScore - fp.healthScore) / 100 : null} />} />
          <Stat label="Participation" value={fmtPct(fh?.participationRate)} note={<Change value={fh?.participationRate != null && fp?.participationRate != null ? fh.participationRate - fp.participationRate : null} />} />
          <Stat label="Engagement" value={fmtPct(focus.usage.engagement)} note={<Change value={focus.usage.engagement != null && focus.usagePrev.engagement != null ? focus.usage.engagement - focus.usagePrev.engagement : null} />} />
          <Stat label="Knowledge" value={fmtPct(fh?.avgKnowledge)} note={<Change value={fh?.avgKnowledge != null && fp?.avgKnowledge != null ? fh.avgKnowledge - fp.avgKnowledge : null} />} />
          <Stat label="Features in Use" value={focus.hasUsage ? `${focus.usage.featuresUsed} of ${FEATURES.length}` : "—"} note={focus.hasUsage ? `${focus.usagePrev.featuresUsed} in ${prevLabel}` : undefined} />
          <Stat label="Max Adoption" value={focus.hasUsage ? fmtPct(focus.usage.maxAdoption) : "—"} note={focus.hasUsage ? <Change value={focus.usage.maxAdoption != null && focus.usagePrev.maxAdoption != null ? focus.usage.maxAdoption - focus.usagePrev.maxAdoption : null} /> : undefined} />
        </div>
        <p className="px-5 pb-1 text-[11px] text-slate-500">Changes are against {prevLabel}. Engagement is people who logged in ÷ active users; participation is people who completed training ÷ active users. Both are for an average month, as in Axonify&apos;s Participation report.</p>

        <div className="grid gap-6 border-t hairline p-5 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">What Makes Up the Health Score</h3>
            <p className="mb-2 text-xs text-slate-500">Health Score = 50% participation + 50% knowledge. The bar is the measure; the number on the right is the points it adds out of 100.</p>
            <MeterRow label={`Participation (${HEALTH_WEIGHTS.participation * 100}%)`} value={fh?.participationRate ?? null} display={contribution(fh?.participationRate, HEALTH_WEIGHTS.participation)?.toFixed(0) ?? "—"} tone="good" />
            <MeterRow label={`Knowledge (${HEALTH_WEIGHTS.knowledge * 100}%)`} value={fh?.avgKnowledge ?? null} display={contribution(fh?.avgKnowledge, HEALTH_WEIGHTS.knowledge)?.toFixed(0) ?? "—"} tone="purple" />
            <p className="mt-2 text-xs text-slate-500">Bands: Healthy 75 and above, Moderate 60, At Risk 45, Critical below 45.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Other Signals Worth Watching</h3>
            <p className="mb-2 text-xs text-slate-500">Not part of the score, but they show how widely the platform is used. The black tick is the average across all clients.</p>
            <MeterRow label="Engagement" value={focus.usage.engagement} marker={insights.total.usage.engagement} markerLabel="All clients" tone="orange" />
            <MeterRow label="Licence Use" value={focus.licenceUse} display={fmtPct(focus.licenceUse, 0)} note={focus.licenceUse == null ? "Needs licences in the Salesforce file" : "Average active users ÷ licences"} tone="blue" />
            <MeterRow label="Features in Use" value={focus.usage.featureBreadth} display={focus.hasUsage ? `${focus.usage.featuresUsed}/${FEATURES.length}` : "—"} tone="good" />
            <MeterRow label="Max Adoption" value={focus.usage.maxAdoption} marker={insights.total.usage.maxAdoption} markerLabel="All clients" tone="purple" />
            <MeterRow label="Broadcast Reach" value={focus.usage.commsReach} marker={insights.total.usage.commsReach} markerLabel="All clients" tone="orange" />
            <MeterRow label="Retention" value={fh?.retentionRate ?? null} tone="muted" note="Active again after the previous quarter" />
          </div>
        </div>

        {monthRows.length > 0 && (
          <div className="border-t hairline px-5 py-4">
            <h3 className="text-sm font-semibold">Month by Month</h3>
            <p className="mb-2 text-xs text-slate-500">The latest months of {label}, newest first, so last month can be read against the one before.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="py-1.5 font-semibold">Month</th><th className="py-1.5 text-right font-semibold">Active Users</th><th className="py-1.5 text-right font-semibold">Engagement</th><th className="py-1.5 text-right font-semibold">Training</th><th className="py-1.5 text-right font-semibold">Max Questions</th><th className="py-1.5 text-right font-semibold">Learning Hours</th></tr></thead>
                <MonthRows insight={focus} months={monthRows} />
              </table>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="All Accounts" subtitle="Lowest health first. Select an account to put it in focus above. Renewal risk combines the health band with how soon the contract renews." />
        <DataTable canExport={can(user.role, "export:csv")} exportName={`account-health-${period}`} rows={rows}
          columns={[
            { key: "account", header: "Account" }, { key: "csm", header: "CSM" },
            ...(showLicences ? [{ key: "licences", header: "Licences", align: "right" as const }, { key: "use", header: "Licence Use", align: "right" as const, hint: "Average active users ÷ licences" }] : []),
            { key: "participation", header: "Participation", align: "right" }, { key: "engagement", header: "Engagement", align: "right", hint: "Logged in ÷ active users" },
            { key: "knowledge", header: "Knowledge", align: "right" }, { key: "health", header: "Health", align: "right" }, { key: "status", header: "Status" },
            ...(showRenewal ? [{ key: "renewal", header: "Renewal" }] : []),
          ]} />
      </Card>

      {hvs.healthyCount > 0 && hvs.strugglingCount > 0 && hvsData.length > 0 && (
        <Card>
          <CardHeader title="Healthy vs Struggling Accounts" subtitle={`What is different between the ${hvs.healthyCount} Healthy or Moderate accounts and the ${hvs.strugglingCount} At Risk or Critical ones (each client counts once)`} />
          <div className="p-4"><CompareBars entities data={hvsData} xKey="measure" series={[{ key: "Healthy", label: "Healthy or Moderate" }, { key: "Struggling", label: "At Risk or Critical" }]} /></div>
        </Card>
      )}
    </div>
  );
}

function MonthRows({ insight, months }: { insight: ClientInsight; months: string[] }) {
  return (
    <tbody>
      {months.map((m) => {
        const u = insight.monthly.get(m);
        return (
          <tr key={m} className="border-t hairline">
            <td className="py-1.5">{monthName(m)}</td>
            <td className="py-1.5 text-right tabular-nums">{fmtNumber(u?.activeUsers)}</td>
            <td className="py-1.5 text-right tabular-nums">{u && u.activeUsers > 0 ? fmtPct(u.loggedInUsers / u.activeUsers) : "—"}</td>
            <td className="py-1.5 text-right tabular-nums">{u && u.activeUsers > 0 ? fmtPct(u.trainingUsers / u.activeUsers) : "—"}</td>
            <td className="py-1.5 text-right tabular-nums">{fmtNumber(u?.maxQueries)}</td>
            <td className="py-1.5 text-right tabular-nums">{u ? fmtNumber(u.learningSeconds / 3600) : "—"}</td>
          </tr>
        );
      })}
    </tbody>
  );
}
