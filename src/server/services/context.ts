import "server-only";
import { cookies } from "next/headers";
import { getAdapters } from "@/server/data";
import type { ClientPeriodRow, ClientSummary, Result, SourceKind } from "@/server/data/ports";
import { parsePeriodKey, type Period } from "@/server/metrics/period";
import type { Filters } from "./portfolio";

export const FILTER_COOKIE = "ci_filters";

export type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export interface LoadedContext {
  filters: Filters;
  clients: ClientSummary[];
  rows: ClientPeriodRow[];
  source: SourceKind;
  asOf: string;
  availablePeriods: string[];
}

export type ContextResult =
  | { ok: true; ctx: LoadedContext }
  | { ok: false; reason: string; source: SourceKind };

/** URL params win, then the persisted cookie, then the latest period that has data. */
export async function loadContext(sp: SearchParams): Promise<ContextResult> {
  const { analytics } = getAdapters();
  const [c, r] = await Promise.all([analytics.listClients(), analytics.getClientPeriodRows()]);
  const bad = [c, r].find((x): x is Extract<Result<unknown>, { status: "unavailable" }> => x.status === "unavailable");
  if (bad) return { ok: false, reason: bad.reason, source: bad.source };
  if (c.status !== "ok" || r.status !== "ok") return { ok: false, reason: "Unavailable", source: analytics.kind };

  let saved: { client?: string; industry?: string; period?: string } = {};
  try {
    saved = JSON.parse((await cookies()).get(FILTER_COOKIE)?.value ?? "{}");
  } catch {
    /* ignore corrupt cookie */
  }
  const availablePeriods = [...new Set(r.data.map((x) => x.period))].sort();
  const latest = availablePeriods.at(-1);
  const pick = (k: "client" | "industry" | "period") => one(sp[k]) ?? saved[k];

  const clientId = pick("client");
  const industry = pick("industry");
  const period: Period = parsePeriodKey(pick("period") ?? "") ?? parsePeriodKey(latest ?? "") ?? { year: new Date().getUTCFullYear(), quarter: 1 };

  return {
    ok: true,
    ctx: {
      filters: {
        client: clientId && clientId !== "all" && c.data.some((x) => x.id === clientId) ? clientId : null,
        industry: industry && industry !== "all" && c.data.some((x) => x.industry === industry) ? industry : null,
        period,
      },
      clients: c.data,
      rows: r.data,
      source: c.source,
      asOf: r.asOf,
      availablePeriods,
    },
  };
}
