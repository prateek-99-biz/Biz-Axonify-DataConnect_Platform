import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import type { SearchParams } from "@/server/services/context";
import { loadInsights } from "@/server/services/insights-context";
import { growth, MIN_MAX_RATINGS } from "@/server/metrics/features";
import { periodKey, periodLabel, previousPeriod } from "@/server/metrics/period";
import { Card, CardHeader, EmptyState, SourceUnavailable } from "@/components/ui/primitives";
import { KpiStrip } from "@/components/ui/kpi";
import { TrendChart } from "@/components/charts/charts";
import { DataTable, type TableRow } from "@/components/tables/data-table";
import { PeriodNotice } from "@/components/internal/period-notice";
import { Change, InsightsHeader, MeterRow, PlainSummary, UsageNotice } from "@/components/insights/ui";
import { CountingBar } from "@/components/insights/basis";
import { fmtNumber, fmtPct } from "@/lib/utils";

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });

export default async function MaxAiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("dashboard:internal");
  const loaded = await loadInsights(await searchParams);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx, insights, usageReason } = loaded;
  const period = periodKey(ctx.filters.period);
  const label = periodLabel(ctx.filters.period);
  const prevLabel = periodLabel(previousPeriod(ctx.filters.period));

  const header = <InsightsHeader title="Max AI Usage" subtitle={`How each client uses Max, Axonify's AI assistant, in ${label}: how many people ask it questions, how often, and how its answers land.`} />;
  if (!insights.hasUsage) {
    return <div className="space-y-6">{header}<UsageNotice reason={usageReason} /></div>;
  }

  const t = insights.total;
  const withUsage = insights.clients.filter((c) => c.hasUsage);
  const using = withUsage.filter((c) => c.usage.maxQueries > 0).sort((a, b) => (b.usage.maxPer100 ?? 0) - (a.usage.maxPer100 ?? 0));
  const notUsing = withUsage.filter((c) => c.usage.maxQueries === 0).sort((a, b) => (b.usage.avgActiveUsers ?? 0) - (a.usage.avgActiveUsers ?? 0));
  // Per day of data, so a quarter in progress is not read as a fall (49 days of Q4 against 92 of Q3).
  const qChange = t.maxChange;
  const partial = (insights.pace ?? 1) < 0.999;
  const paceWord = partial ? ", per day of data," : "";
  const never = notUsing.filter((c) => c.usagePrev.maxQueries === 0 && c.usageYearAgo.maxQueries === 0);
  const stopped = notUsing.filter((c) => !never.includes(c));
  const names = (l: typeof notUsing) => `${l.slice(0, 6).map((c) => c.client.name).join(", ")}${l.length > 6 ? ` and ${l.length - 6} more` : ""}`;
  const top = using.find((c) => c.ranked) ?? using[0];

  // Every client's months added together, for the last 24 months up to the end of the period.
  const end = insights.months.at(-1)!;
  const allMonths = [...new Set(insights.clients.flatMap((c) => [...c.monthly.keys()]))].filter((m) => m <= end).sort().slice(-24);
  const trend = allMonths.map((m) => {
    let q = 0, u = 0, a = 0;
    for (const c of insights.clients) { const r = c.monthly.get(m); if (r) { q += r.maxQueries; u += r.maxUsers; a += r.activeUsers; } }
    // The month the data stops in is only partly counted, so it says so instead of looking like a fall.
    return { month: m === ctx.asOf.slice(0, 7) ? `${monthName(m)} (to date)` : monthName(m), questions: q, people: u, adoption: a > 0 ? u / a : null };
  });
  const firstMaxMonth = allMonths.find((m) => insights.clients.some((c) => (c.monthly.get(m)?.maxQueries ?? 0) > 0));
  const shownTrend = firstMaxMonth ? trend.slice(Math.max(0, allMonths.indexOf(firstMaxMonth) - 1)) : trend;

  const summary = [
    `${using.length} of ${withUsage.length} clients used Max in ${label}. Their people asked ${fmtNumber(t.usage.maxQueries)} question${t.usage.maxQueries === 1 ? "" : "s"}${qChange != null ? `, ${qChange >= 0 ? "up" : "down"} ${Math.abs(qChange * 100).toFixed(0)}% on ${prevLabel}${paceWord.replace(/,$/, "")}` : ""}.`,
    top ? `${top.client.name} uses Max the most: ${top.usage.maxPer100!.toFixed(1)} questions per 100 active users a month, with ${fmtPct(top.usage.maxAdoption)} of its people asking.` : "",
    t.usage.maxQueries > 0 ? `${fmtPct(t.usage.maxGroundedRate, 0)} of answers cited the client's own Axonify content${t.usage.maxHelpfulRate != null ? `, and ${fmtPct(t.usage.maxHelpfulRate, 0)} of rated answers were not marked unhelpful (${fmtNumber(t.usage.maxRated)} ratings)` : ""}.` : "",
    never.length ? `Not using Max yet: ${names(never)}. These are the conversations to have about switching it on.` : "",
    stopped.length ? `Used Max before but not in ${label}: ${names(stopped)}. Worth asking what changed.` : "",
    notUsing.length === 0 ? "Every client with data used Max this period." : "",
  ];

  const rows: TableRow[] = [...using, ...notUsing].map((c) => {
    const u = c.usage;
    const change = c.maxChange;
    return {
      id: c.client.id, href: `/clients/${c.client.id}?period=${period}`,
      cells: {
        client: { v: c.client.name }, csm: { v: c.client.csmName || "Unassigned", node: <span className="whitespace-nowrap">{c.client.csmName || "Unassigned"}</span> },
        questions: { v: u.maxQueries, node: fmtNumber(u.maxQueries) },
        change: { v: change, node: <Change value={change} format="growth" /> },
        people: { v: u.maxUsers, node: fmtNumber(u.maxUsers) },
        adoption: { v: u.maxAdoption, node: fmtPct(u.maxAdoption) },
        per100: { v: u.maxQueries > 0 ? u.maxPer100 : null, node: u.maxQueries > 0 ? fmtNumber(u.maxPer100, 1) : "—" },
        perUser: { v: u.maxPerUser, node: fmtNumber(u.maxPerUser, 1) },
        grounded: { v: u.maxGroundedRate, node: fmtPct(u.maxGroundedRate, 0) },
        helpful: { v: u.maxHelpfulRate, node: u.maxHelpfulRate == null ? (u.maxRated > 0 ? `${u.maxRated} rating${u.maxRated === 1 ? "" : "s"}` : "—") : fmtPct(u.maxHelpfulRate, 0) },
      },
    };
  });

  return (
    <div className="space-y-6">
      {header}
      <PeriodNotice label={label} progress={ctx.progress} asOf={ctx.asOf} />
      <UsageNotice reason={usageReason} />
      <CountingBar basis={loaded.basis} available={loaded.programsAvailable} gaps={loaded.gaps} names={Object.fromEntries(ctx.clients.map((c) => [c.id, c.name]))} />
      <PlainSummary points={summary} />

      <KpiStrip items={[
        { label: "Questions Asked", value: fmtNumber(t.usage.maxQueries), note: qChange != null ? `${qChange >= 0 ? "+" : "−"}${Math.abs(qChange * 100).toFixed(0)}% on ${prevLabel}${partial ? " per day" : ""}` : undefined },
        { label: "People Using Max", value: fmtNumber(t.usage.maxUsers / Math.max(1, t.usage.months)), note: "in an average month" },
        { label: "Adoption", value: fmtPct(t.usage.maxAdoption), note: "of active users, average month" },
        { label: "Clients Using Max", value: `${using.length} of ${withUsage.length}` },
      ]} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Questions Asked Over Time" subtitle="All clients together, by month. The last month is counted to date." />
          <div className="p-4"><TrendChart entities data={shownTrend} xKey="month" format="number" series={[{ key: "questions", label: "Questions Asked" }]} /></div>
        </Card>
        <Card>
          <CardHeader title="Max Adoption Over Time" subtitle="Share of all active users who asked Max a question, by month: how many people, not how often" />
          <div className="p-4"><TrendChart data={shownTrend} xKey="month" series={[{ key: "adoption", label: "Adoption", color: "#682685" }]} /></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Max Adoption by Client" subtitle="Share of each client's active users who asked Max a question in an average month, highest first" />
        <div className="px-5 py-3">
          {[...using].sort((a, b) => (b.usage.maxAdoption ?? 0) - (a.usage.maxAdoption ?? 0)).map((c) => <MeterRow key={c.client.id} label={c.client.name} href={`/insights/benchmarks?period=${period}&focus=${c.client.id}`} value={c.usage.maxAdoption} marker={t.usage.maxAdoption} markerLabel="All clients" tone="purple" note={`${fmtNumber(c.usage.maxQueries)} question${c.usage.maxQueries === 1 ? "" : "s"}`} />)}
          {using.length === 0 && <EmptyState title="No client used Max in this period" />}
        </div>
      </Card>

      <Card>
        <CardHeader title="Every Client" subtitle={`Ranked by questions per 100 active users. Rated Helpful needs at least ${MIN_MAX_RATINGS} ratings.`} />
        <DataTable canExport={can(user.role, "export:csv")} exportName={`max-ai-${period}`} rows={rows}
          columns={[
            { key: "client", header: "Client" }, { key: "csm", header: "CSM" },
            { key: "questions", header: "Questions", align: "right" }, { key: "change", header: partial ? `Per Day vs ${prevLabel}` : `Change vs ${prevLabel}`, align: "right" },
            { key: "people", header: "People Asking", align: "right", hint: "Distinct people per month, added across the months" },
            { key: "adoption", header: "Adoption", align: "right", hint: "People asking ÷ active users, average month" },
            { key: "per100", header: "Per 100 Users", align: "right", hint: "Questions per 100 active users a month" },
            { key: "perUser", header: "Per Person", align: "right", hint: "Questions per person who used Max" },
            { key: "grounded", header: "From Client Content", align: "right", hint: "Answers that cited a page, topic, module or file from the client's Axonify" },
            { key: "helpful", header: "Rated Helpful", align: "right", hint: "Rated answers not marked unhelpful" },
          ]} />
        <p className="border-t hairline py-3 pl-5 pr-[max(1.25rem,calc(100%_-_120ch))] text-xs text-slate-500">
          Max data comes from the DataConnect views max_user_query and max_response_sources. Question text is never copied into this platform. <Link href="/metrics" className="underline">What the metrics mean</Link>.
        </p>
      </Card>
    </div>
  );
}
