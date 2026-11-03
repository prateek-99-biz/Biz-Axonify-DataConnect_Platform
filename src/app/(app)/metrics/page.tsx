import Link from "next/link";
import { requirePagePermission } from "@/server/auth/guard";
import { DECLINE_THRESHOLD } from "@/server/services/portfolio";
import { HEALTH_WEIGHTS, METRIC_DEFINITIONS, RISK_THRESHOLDS, type MetricDefinition } from "@/server/metrics/definitions";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { RiskBadge } from "@/components/ui/risk-badge";
import { statusLabel } from "@/lib/labels";

/** Plain-language wording for each metric. The formulas themselves come from METRIC_DEFINITIONS, so they cannot drift from the numbers on the pages. */
const PLAIN: Record<string, { plain: string; read: string }> = {
  registered_users: { plain: "Everyone who had a login with this client at any point in the quarter, including people who left during it.", read: "A falling number usually means leavers or a smaller rollout, not weaker learning." },
  active_users: { plain: "People whose account was live in the quarter. It is not the number who logged in.", read: "It stays close to Registered Users, so use Participation to see who actually trained." },
  training_users: { plain: "Active people who completed at least one training session in the quarter.", read: "The top half of the Participation fraction." },
  participation_rate: { plain: "Of the people with a live account, the share who actually trained. The clearest sign of whether the training is being used.", read: `A drop of ${Math.round(Math.abs(DECLINE_THRESHOLD) * 100)} points or more against the previous quarter raises a Declining Participation alert.` },
  avg_knowledge: { plain: "How well people currently score on the topics they have been given, averaged across everyone with a score.", read: "High knowledge with low participation means the few who train do well, not that the whole team is learning." },
  retention_rate: { plain: "Of last quarter's active people, the share who were active again this quarter.", read: "Low retention points to turnover or people dropping out of the programme." },
  engagement_rate: { plain: "The share of registered users whose account is live. Because live means a live account, it sits close to 100% for most clients.", read: "It says little on its own. Treat it as low-signal and rely on Participation." },
  feature_adoption: { plain: "The share of Axonify features available to the client that were used.", read: "Not available from the data yet, so it is hidden wherever it has no value." },
  health_score: { plain: "One number from 0 to 100 that blends participation and knowledge equally.", read: "Use it to sort and spot trouble, then open the client to see which half moved." },
};

const SECTIONS: { title: string; subtitle: string; keys: string[] }[] = [
  { title: "People", subtitle: "Who is on the books and who is using the platform", keys: ["registered_users", "active_users", "training_users"] },
  { title: "Learning", subtitle: "Whether training is happening and whether it sticks", keys: ["participation_rate", "avg_knowledge"] },
  { title: "Usage and Retention", subtitle: "How steady and broad the usage is", keys: ["retention_rate", "engagement_rate", "feature_adoption"] },
  { title: "Overall", subtitle: "The single score used to rank clients", keys: ["health_score"] },
];

const byKey = new Map<string, MetricDefinition>(METRIC_DEFINITIONS.map((d) => [d.key, d]));

// The worked example is calculated from the same weights the dashboard uses.
const EXAMPLE = { participation: 0.4, knowledge: 0.9 };
const exampleScore = 100 * (HEALTH_WEIGHTS.participation * EXAMPLE.participation + HEALTH_WEIGHTS.knowledge * EXAMPLE.knowledge);

const BANDS = [
  { risk: "healthy", rule: `${RISK_THRESHOLDS.healthy} or more`, meaning: "On track. Keep the rhythm going." },
  { risk: "moderate", rule: `${RISK_THRESHOLDS.moderate} to ${RISK_THRESHOLDS.healthy - 1}`, meaning: "Fine, but worth watching for a slide." },
  { risk: "at_risk", rule: `${RISK_THRESHOLDS.atRisk} to ${RISK_THRESHOLDS.moderate - 1}`, meaning: "Needs attention from the CSM." },
  { risk: "critical", rule: `Below ${RISK_THRESHOLDS.atRisk}`, meaning: "Raises a Critical Health Score alert." },
] as const;

const CARE: { heading: string; body: string }[] = [
  { heading: "Knowledge is only known from when the dashboard first saw it", body: "Axonify keeps each learner's current score, not their past ones. The dashboard saves knowledge at every refresh, so older quarters have none and their Health Score is blank rather than guessed." },
  { heading: "Changes are in points, not percent", body: "\"pts\" means percentage points, so 40% to 36% is −4 pts. User counts are the exception and compare as a percent change." },
  { heading: "Quarters are calendar quarters", body: "Q1 is January to March and Q4 is October to December. \"vs prev\" compares with the quarter before, and \"YoY\" with the same quarter a year earlier." },
  { heading: "No data is never shown as zero", body: "A client with no records for the chosen quarter is listed as having no data and left out of the averages, so it cannot drag them down." },
  { heading: "CSM and industry come from Salesforce", body: "Axonify does not hold them. They appear once an admin imports the Salesforce account file, and clients without one are grouped as Unassigned." },
];

export default async function MetricsPage() {
  await requirePagePermission("dashboard:read");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">What the Metrics Mean</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Every number in the dashboard is calculated one way, defined here. If a figure looks odd, check its meaning below first, then see <Link href="/how-it-works" className="underline">How It Works</Link> for where the data comes from.
        </p>
      </div>

      <Card>
        <CardHeader title="The Client Health Score" subtitle="The number that ranks every client" />
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <div className="space-y-3 text-sm">
            <p>Health is a score from 0 to 100. Half comes from <strong>participation</strong> (are people training?) and half from <strong>knowledge</strong> (are they learning?).</p>
            <p className="rounded-xl bg-brand/10 px-4 py-3 font-mono text-xs">Health = 100 × ({HEALTH_WEIGHTS.participation * 100}% × participation + {HEALTH_WEIGHTS.knowledge * 100}% × knowledge)</p>
            <p className="text-slate-600">
              <span className="font-medium text-ink">Worked example.</span> A client where {EXAMPLE.participation * 100}% of active users trained and average knowledge is {EXAMPLE.knowledge * 100}% scores 100 × (0.5 × {EXAMPLE.participation} + 0.5 × {EXAMPLE.knowledge}) = <strong>{exampleScore}</strong>, which is Moderate.
            </p>
          </div>
          <div>
            <table className="w-full text-sm">
              <caption className="sr-only">Health bands</caption>
              <thead className="text-left text-xs text-slate-500"><tr><th className="pb-2 font-medium">Band</th><th className="pb-2 font-medium">Score</th><th className="pb-2 font-medium">What it means</th></tr></thead>
              <tbody className="divide-y divide-line">
                {BANDS.map((b) => (
                  <tr key={b.risk}><td className="py-2 pr-3"><RiskBadge risk={b.risk} /></td><td className="py-2 pr-3 tabular-nums">{b.rule}</td><td className="py-2 text-slate-600">{b.meaning}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">These weights and bands follow Biz Group&rsquo;s Power BI report.</p>
          </div>
        </div>
      </Card>

      {SECTIONS.map((s) => (
        <Card key={s.title}>
          <CardHeader title={s.title} subtitle={s.subtitle} />
          <ul className="divide-y divide-line">
            {s.keys.map((k) => {
              const d = byKey.get(k);
              if (!d) return null;
              return (
                <li key={k} className="grid gap-x-8 gap-y-2 px-5 py-4 text-sm lg:grid-cols-[14rem_1fr]">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold">{d.name}</span>
                    <Badge tone={d.status === "approved" ? "good" : "warn"} title={d.status === "approved" ? "Matches Biz Group's Power BI report" : "Not yet signed off by Biz Group"}>{statusLabel(d.status)}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    <p>{PLAIN[k]?.plain ?? d.description}</p>
                    <p className="text-xs text-slate-500"><span className="font-medium text-ink">How it is calculated:</span> {d.formula}.</p>
                    {PLAIN[k] && <p className="text-xs text-slate-500"><span className="font-medium text-ink">How to read it:</span> {PLAIN[k].read}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      <Card>
        <CardHeader title="Read With Care" subtitle="Where a number can mislead if you do not know the rule behind it" />
        <ul className="divide-y divide-line">
          {CARE.map((c) => (
            <li key={c.heading} className="px-5 py-3 text-sm">
              <p className="font-medium">{c.heading}</p>
              <p className="mt-0.5 text-xs text-slate-600">{c.body}</p>
            </li>
          ))}
        </ul>
        <p className="border-t hairline px-5 py-3 text-xs text-slate-500">
          <strong>Approved</strong> means the definition matches Biz Group&rsquo;s Power BI report. <strong>Provisional</strong> means it is in use but not yet signed off.
        </p>
      </Card>
    </div>
  );
}
