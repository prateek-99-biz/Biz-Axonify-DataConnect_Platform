/**
 * Reads the daily-synced reporting summaries from Postgres (filled by src/server/sync). Fast and free:
 * pages never hit BigQuery. Capabilities not covered by the summaries return `unavailable` honestly.
 */
import { db } from "@/server/db";
import type { AnalyticsPort, ClientPeriodRow, ClientSummary, Result } from "../../ports";

const unavailable = (reason: string): Result<never> => ({ status: "unavailable", reason, source: "synced" });

async function lastSync(): Promise<Date | null> {
  const run = await db.syncRun.findFirst({ where: { status: "ok" }, orderBy: { finishedAt: "desc" } });
  return run?.finishedAt ?? null;
}

const NO_SYNC = "No data has been synced yet. An admin can press “Refresh data” once the BigQuery mapping is configured.";

export const syncedAnalytics: AnalyticsPort = {
  kind: "synced",

  async listClients() {
    const at = await lastSync();
    if (!at) return unavailable(NO_SYNC);
    const rows = await db.syncClient.findMany({ orderBy: { name: "asc" } });
    const data: ClientSummary[] = rows.map((r) => ({ ...r }));
    return { status: "ok", data, source: "synced", asOf: at.toISOString() };
  },

  async getClientPeriodRows(clientIds) {
    const at = await lastSync();
    if (!at) return unavailable(NO_SYNC);
    const rows = await db.syncClientPeriod.findMany({ where: clientIds ? { clientId: { in: clientIds } } : undefined });
    return { status: "ok", data: rows as ClientPeriodRow[], source: "synced", asOf: at.toISOString() };
  },

  async getTeamTree() {
    return unavailable("Team hierarchy is not part of the synced summaries yet.");
  },
  async getUsers() {
    return unavailable("User-level data is not part of the synced summaries yet.");
  },
  async getSourceCoverage() {
    return unavailable("Source coverage is not part of the synced summaries yet. Sync history is shown on the Data reliability page.");
  },
};
