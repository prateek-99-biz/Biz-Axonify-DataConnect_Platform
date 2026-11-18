"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { cn, fmtNumber, fmtPct } from "@/lib/utils";
import { USER_BASIS_COOKIE, type BasisGap, type UserBasis } from "@/server/metrics/basis";

const OPTIONS: { value: UserBasis; label: string; hint: string }[] = [
  { value: "all", label: "All Users", hint: "Everyone with an active account, as AdminZone's All Users view. Broadcasts, chat and the other features reach all of them." },
  { value: "programs", label: "In Training Programs", hint: "Only people in teams inside a training program, as AdminZone's default Users in Active Training Programs view." },
];

/**
 * Switches every share on the Insights pages between AdminZone's two Participation views. The choice is kept in a
 * cookie, so it follows the user from page to page, and written to the URL, so a shared link shows the same view.
 */
export function BasisToggle({ basis, available }: { basis: UserBasis; available: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const choose = (v: UserBasis) => {
    try { document.cookie = `${USER_BASIS_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`; } catch { /* cookies blocked: the URL still carries it */ }
    const params = new URLSearchParams(sp.toString());
    params.set("users", v);
    start(() => router.replace(`${path}?${params.toString()}`));
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className="flex items-center gap-1.5 font-medium"><Users className="h-3.5 w-3.5" aria-hidden />Count</span>
      <div role="radiogroup" aria-label="Which users the figures count" className={cn("inline-flex rounded-lg border hairline p-0.5", pending && "opacity-60")}>
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={basis === o.value} title={o.hint}
            disabled={!available && o.value === "programs"}
            onClick={() => basis !== o.value && choose(o.value)}
            className={cn("rounded-md px-2.5 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              basis === o.value ? "bg-brand/15 text-brand-ink" : "hover:bg-slate-500/10")}>
            {o.label}
          </button>
        ))}
      </div>
      {!available && <span>Training-program counts arrive with the next data refresh.</span>}
    </div>
  );
}

/** The toggle and, below it, the clients whose two views differ: what every Insights page shows under its header. */
export function CountingBar({ basis, available, gaps, names }: { basis: UserBasis; available: boolean; gaps: BasisGap[]; names: Record<string, string> }) {
  return (
    <div className="space-y-3">
      <BasisToggle basis={basis} available={available} />
      <BasisGapNotice gaps={gaps} names={names} basis={basis} />
    </div>
  );
}

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** Clients whose All Users and training-program views tell different stories, so nobody misreads a rollout as a collapse. */
export function BasisGapNotice({ gaps, names, basis }: { gaps: BasisGap[]; names: Record<string, string>; basis: UserBasis }) {
  if (gaps.length === 0) return null;
  return (
    <div role="note" className="glass !rounded-xl px-4 py-3 text-xs leading-relaxed text-slate-600">
      <p className="font-semibold text-slate-700 dark:text-slate-200">
        {gaps.length === 1 ? "One client has" : `${gaps.length} clients have`} many people who are not in a training program yet
        {basis === "all" ? ", which pulls their All Users figures down:" : ". These figures leave them out:"}
      </p>
      <ul className="mt-1.5 space-y-1">
        {gaps.map((g) => (
          <li key={g.clientId}>
            <span className="font-semibold">{names[g.clientId] ?? g.clientId}</span>: {fmtNumber(g.outside)} of {fmtNumber(g.allActive)} active users in {monthName(g.month)} are outside training programs.
            Engagement is {fmtPct(g.allEngagement)} for all users and {fmtPct(g.programEngagement)} for the {fmtNumber(g.programActive)} in training programs.
          </li>
        ))}
      </ul>
    </div>
  );
}
