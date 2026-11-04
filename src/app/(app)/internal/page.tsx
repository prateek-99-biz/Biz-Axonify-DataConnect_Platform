import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requirePagePermission } from "@/server/auth/guard";
import { can } from "@/server/auth/rbac";
import { loadContext, type SearchParams } from "@/server/services/context";
import { buildPortfolio, deriveAlerts } from "@/server/services/portfolio";
import { ackedAlertKeys } from "@/server/services/alert-acks";
import { bookSummary, buildAccountCards, buildRenewals, buildWatchlist, csmKey, csmKeyForEmail, NO_SIGNAL, renewalValueByCurrency } from "@/server/services/accounts";
import { sampleCount } from "@/server/services/salesforce-accounts";
import { periodKey, periodLabel } from "@/server/metrics/period";
import { Badge, Card, SourceUnavailable } from "@/components/ui/primitives";
import { SampleNotice } from "@/components/internal/sample-notice";
import { cn, fmtNumber } from "@/lib/utils";

interface Tile { name: string; href: string | null; value: string; note: string; status?: string }

function TileView({ t }: { t: Tile }) {
  const body = (
    <Card className={cn("h-full p-5 transition-all duration-300", t.href ? "border-t-4 border-t-biz-purple group-hover:-translate-y-0.5 group-hover:shadow-lift" : "border-dashed")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{t.name}</p>
        {t.status ? <Badge>{t.status}</Badge> : <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />}
      </div>
      <p className={cn("mt-3 text-3xl font-semibold tabular-nums tracking-tight", !t.href && "text-slate-400")}>{t.value}</p>
      <p className="mt-1 text-xs text-slate-600">{t.note}</p>
    </Card>
  );
  return t.href ? <Link href={t.href} className="group block">{body}</Link> : <div className="group">{body}</div>;
}

export default async function InternalHomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission("dashboard:internal");
  const loaded = await loadContext(await searchParams);
  if (!loaded.ok) return <SourceUnavailable reason={loaded.reason} />;
  const { ctx } = loaded;
  const period = periodKey(ctx.filters.period);
  const today = new Date().toISOString().slice(0, 10);
  const sample = await sampleCount();

  const view = buildPortfolio(ctx.clients, ctx.rows, { ...ctx.filters, client: null, industry: null });
  const acked = new Set(await ackedAlertKeys(user.id));
  const openAlerts = deriveAlerts(view, ctx.filters.period).filter((a) => !acked.has(a.key));
  const watch = buildWatchlist(view.clients, ctx.rows, ctx.filters.period);
  const renewals = buildRenewals(ctx.clients, view.clients, today, 90);
  const renewTotals = renewalValueByCurrency(renewals);

  const mine = csmKeyForEmail(user.email, ctx.clients);
  const books = new Set(ctx.clients.map(csmKey).filter((k) => k !== ""));
  let accountsTile: Tile;
  if (mine) {
    const s = bookSummary(buildAccountCards(ctx.clients.filter((c) => csmKey(c) === mine), ctx.rows, ctx.filters.period, new Map([["", NO_SIGNAL]]), today));
    accountsTile = { name: "My Accounts", href: "/csm", value: String(s.accounts), note: `${s.needAttention} need attention · ${s.renewing90} renewing in 90 days` };
  } else {
    accountsTile = { name: "My Accounts", href: "/csm", value: String(books.size), note: books.size === 0 ? "No CSM data loaded yet" : `CSM book${books.size === 1 ? "" : "s"}; pick one to view` };
  }

  const tiles: Tile[] = [
    accountsTile,
    { name: "Alerts and Watchlist", href: "/alerts", value: String(openAlerts.length), note: `${openAlerts.filter((a) => a.severity === "critical").length} critical · ${watch.length} on the watchlist` },
    { name: "Renewals", href: "/renewals", value: String(renewals.length), note: renewTotals.length ? `in 90 days · ${renewTotals.map((t) => `${t.currency} ${fmtNumber(Math.round(t.total))}`).join(" · ")}` : "in 90 days" },
    { name: "Account Health", href: "/portfolio", value: view.kpis.current.healthScore?.toFixed(0) ?? "—", note: `portfolio average · ${view.riskCounts.critical + view.riskCounts.at_risk} Critical or At Risk` },
    { name: "Benchmarks and Value", href: null, value: "—", note: "Needs industry and an Axonify-wide benchmark, plus learning hours.", status: "Not Yet" },
    { name: "Cost To Serve", href: null, value: "—", note: "Admins and finance. Needs CSM and technical hours, and cost per hour.", status: "Not Yet" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Internal Home<Badge tone="biz" className="ml-3 align-middle">Internal Only</Badge></h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          The pages only the Biz team sees, with one live number from each, for {periodLabel(ctx.filters.period)}. Nothing here is shown to clients.
          {" "}Your role is {can(user.role, "settings:manage") ? "Admin" : "Member"}.
        </p>
      </div>
      <SampleNotice count={sample} canRemove={can(user.role, "settings:manage")} />
      <section aria-label="Internal pages" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => <TileView key={t.name} t={t} />)}
      </section>
      <p className="text-xs text-slate-500">Period {period}. Pages marked Not Yet are waiting on data that no system holds today. See <Link href="/how-it-works" className="underline">How It Works</Link>.</p>
    </div>
  );
}
