import Link from "next/link";
import { ArrowRight, Database, FileSpreadsheet, LayoutDashboard, RefreshCw } from "lucide-react";
import { requirePagePermission } from "@/server/auth/guard";
import { can, ROLE_LABEL, type Permission } from "@/server/auth/rbac";
import { RISK_THRESHOLDS } from "@/server/metrics/definitions";
import { DECLINE_THRESHOLD } from "@/server/services/portfolio";
import { NAV } from "@/components/shell/nav";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";

const STEPS = [
  { icon: Database, title: "Axonify", body: "Learning activity lives in Axonify DataConnect, a BigQuery dataset. The dashboard only reads from it." },
  { icon: RefreshCw, title: "Refresh", body: "An administrator presses Refresh Data. The latest figures are copied into the dashboard's own database. Pages never query Axonify while you wait." },
  { icon: FileSpreadsheet, title: "Salesforce Data", body: "CSM, industry, licences and renewal dates are loaded from a CSV by an administrator until the live Salesforce link exists." },
  { icon: LayoutDashboard, title: "This Dashboard", body: "Pages combine the two and calculate the metrics. The \"as of\" time at the top of Portfolio shows when the data was last refreshed." },
];

const TOOLS: { name: string; body: string }[] = [
  { name: "Filters", body: "Client, Industry, Year and Quarter sit under the top bar. Your choice follows you from page to page and is remembered." },
  { name: "Search", body: "Type two letters of a client's name in the top bar to jump straight to its profile." },
  { name: "Refresh Data", body: "Admins only. Brings in fresh figures from Axonify. Wait about a minute before pressing it again." },
  { name: "Alerts Bell", body: "Lists clients that need attention in the chosen quarter. Acknowledge an alert to clear it from your list." },
  { name: "CSV Button", body: "Above most tables. Downloads exactly the rows you can see." },
  { name: "Light and Dark", body: "The sun or moon switch in the top bar changes the theme." },
];

/** Teams, Users and Engagement read team-level data that the refreshed summaries do not hold yet, so they say so; Client Dashboards has that detail. */
const TABS: readonly (readonly [name: string, body: string, available: boolean])[] = [
  ["Overview", "Health, participation, knowledge and retention with trends, plus what changed and a peer comparison.", true],
  ["Teams", "Team hierarchy. Not available yet from the refreshed data. See Client Dashboards for team performance.", false],
  ["Users", "Individual learners. Not available yet from the refreshed data.", false],
  ["Engagement", "Active users and engagement by team. Not available yet. Client Dashboards has engagement by team.", false],
  ["Contract & Renewals", "Contract start, end and licence value, from the Salesforce file.", true],
  ["Notes & Tasks", "Your team's notes and follow-ups for the client.", true],
];

const ROLES: { role: keyof typeof ROLE_LABEL; sees: string }[] = [
  { role: "ADMIN", sees: "Everything, plus Settings (users and Salesforce data) and Refresh Data." },
  { role: "MEMBER", sees: "Every analysis page, notes and tasks, CSV downloads and commercial details. No Settings or Refresh." },
  { role: "CLIENT", sees: "Only the quarterly review dashboard for their own company." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Why is Health Score blank for an older quarter?", a: "Health needs knowledge, and Axonify only keeps each learner's current score. The dashboard has saved knowledge since it first refreshed, so earlier quarters have none. They are left blank rather than guessed." },
  { q: "Why does a client say it has no data?", a: "It has no Axonify records in the quarter you picked, often because it had not launched yet. Choose a later quarter. Such clients are left out of averages, never counted as zero." },
  { q: "Why is a CSM shown as Unassigned?", a: "CSM names come from the Salesforce file, not Axonify. An administrator can add them in Settings by importing the CSV." },
  { q: "Why are the numbers different from the Axonify portal?", a: "The dashboard follows Biz Group's Power BI definitions, listed on What the Metrics Mean. Refresh timing also matters, so check the \"as of\" time." },
  { q: "How current is the data?", a: "As current as the last refresh. The \"as of\" time at the top of Portfolio shows it, and Data Reliability lists every refresh and whether it worked." },
  { q: "A refresh failed. What now?", a: "Failed refreshes keep the previous data, so nothing disappears. An administrator can see the reason on Data Reliability. A common cause is an expired Google sign-in." },
  { q: "How do I add someone?", a: "Admins use Settings, then User Management, then Add User. The person gets an email with a link to choose a password." },
];

export default async function HowItWorksPage() {
  const user = await requirePagePermission("dashboard:read");
  const mine = NAV.filter((n) => can(user.role, n.perm as Permission));
  const adminOnly = new Set(["/settings"]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">How It Works</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          A guide to where the numbers come from, where to find each page and what the tools do. For what each number means, see <Link href="/metrics" className="underline">What the Metrics Mean</Link>.
        </p>
      </div>

      <Card>
        <CardHeader title="Where the Numbers Come From" subtitle="Four steps from Axonify to your screen" />
        <ol className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl bg-brand/10 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-navy">{i + 1}</span>
                <s.icon className="h-5 w-5 text-brand-ink" aria-hidden />
              </div>
              <p className="mt-3 font-semibold">{s.title}</p>
              <p className="mt-1 text-xs text-slate-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader title="Where to Find Things" subtitle="Every page in the menu, and what it is for" />
        <ul className="grid gap-px bg-line/60 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((n) => (
            <li key={n.href} className="bg-surface">
              <Link href={n.href} className="group flex h-full items-start gap-3 p-4 transition-colors hover:bg-brand/10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-ink"><n.icon className="h-4 w-4" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold">{n.label}{adminOnly.has(n.href) && <Badge tone="warn">Admins Only</Badge>}<ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /></span>
                  <span className="mt-0.5 block text-xs text-slate-600">{PAGE_BLURB[n.href] ?? n.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Inside a Client Profile" subtitle="Open any client from Portfolio, Clients or the search box" />
          <dl className="divide-y divide-line">
            {TABS.map(([name, body, available]) => (
              <div key={name} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="flex flex-wrap items-center gap-2 font-medium">{name}{!available && <Badge tone="neutral">Not Yet</Badge>}</dt>
                <dd className="text-xs text-slate-600">{body}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Tools on Every Page" subtitle="The controls around the edges" />
          <dl className="divide-y divide-line">
            {TOOLS.map((t) => (
              <div key={t.name} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[10rem_1fr]"><dt className="font-medium">{t.name}</dt><dd className="text-xs text-slate-600">{t.body}</dd></div>
            ))}
          </dl>
        </Card>
      </div>

      <Card>
        <CardHeader title="Alerts and Risk" subtitle="How the dashboard decides a client needs attention" />
        <div className="space-y-2 p-5 text-sm">
          <p>Each client gets a Health Score from 0 to 100 and a band: Healthy at {RISK_THRESHOLDS.healthy} or more, Moderate from {RISK_THRESHOLDS.moderate}, At Risk from {RISK_THRESHOLDS.atRisk}, and Critical below that.</p>
          <p>Two alerts are raised automatically in the chosen quarter:</p>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">
            <li><strong>Critical Health Score</strong> when a client is in the Critical band.</li>
            <li><strong>Declining Participation</strong> when participation falls by {Math.round(Math.abs(DECLINE_THRESHOLD) * 100)} points or more against the previous quarter.</li>
          </ul>
          <p className="text-xs text-slate-500">Alerts are worked out from the data each time, so they clear themselves once a client recovers. To track follow-up, add a task on the client&rsquo;s Notes &amp; Tasks tab.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Who Can See What" subtitle={`You are signed in as ${ROLE_LABEL[user.role]}`} />
        <ul className="divide-y divide-line">
          {ROLES.map((r) => (
            <li key={r.role} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[10rem_1fr]">
              <span className="flex items-center gap-2 font-medium">{ROLE_LABEL[r.role]}{r.role === user.role && <Badge tone="good">You</Badge>}</span>
              <span className="text-xs text-slate-600">{r.sees}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Common Questions" />
        <div className="divide-y divide-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-5 py-3 text-sm">
              <summary className="cursor-pointer list-none font-medium marker:hidden [&::-webkit-details-marker]:hidden"><span className="mr-2 inline-block text-brand-ink transition-transform group-open:rotate-90" aria-hidden>›</span>{f.q}</summary>
              <p className="mt-2 pl-5 text-xs text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}

/** Longer descriptions than the one-line menu hints. */
const PAGE_BLURB: Record<string, string> = {
  "/portfolio": "Every client in one view: totals, trends, who is at risk, and the full client table.",
  "/clients": "A searchable directory. Open a client for its full profile.",
  "/clients/compare": "Pick up to five clients and compare their trends and health, or compare two quarters.",
  "/qbr": "The quarterly review pages for one client: engagement, knowledge, usage, teams and content.",
  "/csm": "Each CSM's accounts and how they are doing, with upcoming renewals.",
  "/data-reliability": "Refresh history, clients missing a key, and every metric definition.",
  "/settings": "Add and manage users, and load the Salesforce account file.",
  "/how-it-works": "This page.",
  "/metrics": "What each number means and how it is calculated.",
};
