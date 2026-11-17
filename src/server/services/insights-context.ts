import "server-only";
import { getAdapters } from "@/server/data";
import { buildInsights, type InsightSet } from "./insights";
import { loadContext, type LoadedContext, type SearchParams } from "./context";

export type InsightsResult =
  | { ok: true; ctx: LoadedContext; insights: InsightSet; /** Why feature and Max usage is missing, when it is. */ usageReason: string | null }
  | { ok: false; reason: string };

/** The global context plus monthly feature and Max usage. Health pages still work when the monthly rows are missing. */
export async function loadInsights(sp: SearchParams): Promise<InsightsResult> {
  const [loaded, months] = await Promise.all([loadContext(sp), getAdapters().analytics.getClientMonthRows()]);
  if (!loaded.ok) return { ok: false, reason: loaded.reason };
  const { ctx } = loaded;
  const rows = months.status === "ok" ? months.data : [];
  const insights = buildInsights(ctx.clients, ctx.rows, rows, ctx.filters.period, ctx.filters.inProgress);
  const usageReason = months.status !== "ok"
    ? months.reason
    : insights.hasUsage ? null : "There is no feature or Max usage for this period. Choose a period from the last two years.";
  return { ok: true, ctx, insights, usageReason };
}
