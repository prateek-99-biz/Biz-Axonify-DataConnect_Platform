import { MIN_TREND_PROGRESS, type PeriodProgress } from "@/server/metrics/period";
import { Badge } from "@/components/ui/primitives";

/** Says so when the chosen quarter or year is still in progress, because a change against a finished period then compares a few weeks with a whole one. */
export function PeriodNotice({ label, progress, asOf }: { label: string; progress: PeriodProgress; asOf: string }) {
  if (progress.fraction >= 1) return null;
  const through = new Date(asOf).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const early = progress.fraction < MIN_TREND_PROGRESS;
  return (
    <p role="note" className="glass flex flex-wrap items-center gap-2 !rounded-xl px-4 py-2 text-xs text-slate-600">
      <Badge tone={early ? "warn" : "neutral"}>In Progress</Badge>
      {label} is not over: the data covers {progress.covered} of {progress.total} days, up to {through}.
      {early ? " Changes against the previous period are not like-for-like, so participation drops are not flagged until it is half over." : " Changes against the previous period compare part of a period with a whole one."}
    </p>
  );
}
