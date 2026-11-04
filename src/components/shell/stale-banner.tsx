import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { ageLabel, staleness } from "@/lib/staleness";
import { cn } from "@/lib/utils";

/** Shown above every page once the data is more than a day old, so a missed nightly refresh cannot go unnoticed. */
export function StaleDataBanner({ asOf, isAdmin }: { asOf: string; isAdmin: boolean }) {
  const s = staleness(asOf, Date.now());
  if (s.level === "fresh") return null;
  const when = new Date(asOf).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return (
    <div role="alert" className={cn("glass flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 !rounded-xl px-4 py-2 text-xs",
      s.level === "very_stale" ? "border-red-300/60 !bg-red-50/80 text-red-900 dark:border-red-300/20 dark:!bg-red-400/10 dark:text-red-100" : "border-amber-300/60 !bg-amber-50/80 text-amber-900 dark:border-amber-300/20 dark:!bg-amber-400/10 dark:text-amber-100")}>
      <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <strong>The data is {ageLabel(s.hours)} old.</strong> The last successful refresh was {when} UTC, so everything here may be behind.
        {isAdmin ? " Run the refresh from a computer with Google access, then check Data Reliability." : " An administrator can refresh it."}
      </span>
      <Link href="/data-reliability" className="underline">See Data Reliability</Link>
    </div>
  );
}
