"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui/primitives";

export interface FilterOptions {
  clients: { id: string; name: string }[];
  industries: string[];
  years: number[];
  current: { client: string | null; industry: string | null; year: number; quarter: number | null };
}

const COOKIE = "ci_filters";

/**
 * Persistent global filters. State lives in the URL (shareable) and is mirrored to a cookie so it
 * survives navigation to pages opened without query params.
 */
export function FilterBar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  // URL wins over the server-resolved defaults (cookie / latest period) passed in from the layout.
  const urlPeriod = /^(\d{4})(?:-Q([1-4]))?$/.exec(sp.get("period") ?? "");
  const urlClient = sp.get("client");
  const urlIndustry = sp.get("industry");
  const c = {
    client: urlClient ? (urlClient === "all" ? null : urlClient) : options.current.client,
    industry: urlIndustry ? (urlIndustry === "all" ? null : urlIndustry) : options.current.industry,
    year: urlPeriod ? Number(urlPeriod[1]) : options.current.year,
    quarter: urlPeriod ? (urlPeriod[2] ? Number(urlPeriod[2]) : null) : options.current.quarter,
  };

  function apply(next: { client?: string | null; industry?: string | null; year?: number; quarter?: number | null }) {
    const m = { ...c, ...next };
    const period = m.quarter ? `${m.year}-Q${m.quarter}` : String(m.year);
    const state = { client: m.client ?? "all", industry: m.industry ?? "all", period };
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=31536000; samesite=lax`;
    const params = new URLSearchParams(sp.toString());
    params.set("client", state.client);
    params.set("industry", state.industry);
    params.set("period", state.period);
    start(() => router.replace(`${path}?${params.toString()}`));
  }

  return (
    <div className="glass flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5" aria-busy={pending}>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Client
        <Select aria-label="Client" value={c.client ?? "all"} onChange={(e) => apply({ client: e.target.value === "all" ? null : e.target.value })} className="max-w-[11rem]">
          <option value="all">All clients</option>
          {options.clients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Industry
        <Select aria-label="Industry" value={c.industry ?? "all"} onChange={(e) => apply({ industry: e.target.value === "all" ? null : e.target.value })}>
          <option value="all">All industries</option>
          {options.industries.map((x) => <option key={x}>{x}</option>)}
        </Select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Year
        <Select aria-label="Year" value={c.year} onChange={(e) => apply({ year: Number(e.target.value) })}>
          {options.years.map((y) => <option key={y}>{y}</option>)}
        </Select>
      </label>
      <label className="flex items-center gap-2 text-xs font-medium text-slate-500">Quarter
        <Select aria-label="Quarter" value={c.quarter ?? 0} onChange={(e) => apply({ quarter: Number(e.target.value) || null })}>
          <option value={0}>Full year</option>
          {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
        </Select>
      </label>
      {pending && <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" aria-hidden />Updating…</span>}
    </div>
  );
}
