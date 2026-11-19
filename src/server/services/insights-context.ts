import "server-only";
import { cookies } from "next/headers";
import { getAdapters } from "@/server/data";
import { USER_BASIS_COOKIE } from "@/server/metrics/basis";
import { basisGaps, onBasis, parseUserBasis, withMonthlyParticipation, type BasisGap, type UserBasis } from "@/server/metrics/features";
import { buildInsights, type InsightSet } from "./insights";
import { loadContext, type LoadedContext, type SearchParams } from "./context";

export type InsightsResult =
  | {
      ok: true; ctx: LoadedContext; insights: InsightSet; /** Why feature and Max usage is missing, when it is. */ usageReason: string | null;
      /** Whose activity the shares are worked out over (the `users` URL parameter; All Users unless asked). */
      basis: UserBasis;
      /** False until a refresh has stored the training-program counts, so the toggle can say why it does nothing. */
      programsAvailable: boolean;
      /** Clients whose All Users and training-program views differ a lot in the period, largest first. */
      gaps: BasisGap[];
    }
  | { ok: false; reason: string };

async function savedBasis(): Promise<string | undefined> {
  try {
    return (await cookies()).get(USER_BASIS_COOKIE)?.value;
  } catch {
    return undefined; // outside a request (tests, scripts)
  }
}

/** The global context plus monthly feature and Max usage. Health pages still work when the monthly rows are missing. */
export async function loadInsights(sp: SearchParams): Promise<InsightsResult> {
  const [loaded, months] = await Promise.all([loadContext(sp), getAdapters().analytics.getClientMonthRows()]);
  if (!loaded.ok) return { ok: false, reason: loaded.reason };
  const { ctx } = loaded;
  const raw = months.status === "ok" ? months.data : [];
  const programsAvailable = raw.some((r) => (r.programActiveUsers ?? 0) > 0);
  // The URL wins (a shared link shows what its sender saw); otherwise the toggle's cookie; otherwise All Users.
  const fromUrl = Array.isArray(sp.users) ? sp.users[0] : sp.users;
  const basis = programsAvailable ? parseUserBasis(fromUrl ?? (await savedBasis())) : "all";
  const rows = onBasis(raw, basis);
  // Participation and health follow the same people as the usage figures.
  const periodRows = basis === "all" ? ctx.rows : withMonthlyParticipation(ctx.rows, rows);
  const insights = buildInsights(ctx.clients, periodRows, rows, ctx.filters.period, ctx.filters.inProgress, { asOf: ctx.asOf, allUserRows: raw });
  const usageReason = months.status !== "ok"
    ? months.reason
    : insights.hasUsage ? null : "There is no feature or Max usage for this period. Choose a period from the last two years.";
  const inScope = new Set(ctx.clients.map((c) => c.id));
  const gaps = basisGaps(raw.filter((r) => inScope.has(r.clientId)), insights.months);
  return { ok: true, ctx, insights, usageReason, basis, programsAvailable, gaps };
}
