/**
 * Reads the daily-synced reporting summaries from Postgres (filled by src/server/sync). Fast and free:
 * pages never hit BigQuery. Capabilities not covered by the summaries return `unavailable` honestly.
 */
import { db } from "@/server/db";
import { cached, SNAPSHOT_STALE_MS, SNAPSHOT_TTL_MS } from "@/server/cache";
import type { AnalyticsPort, ClientPeriodRow, ClientSummary, Result } from "../../ports";

const unavailable = (reason: string): Result<never> => ({ status: "unavailable", reason, source: "synced" });

function lastSync(): Promise<Date | null> {
  return cached("snap:lastSync", SNAPSHOT_TTL_MS, async () => {
    const run = await db.syncRun.findFirst({ where: { status: "ok" }, orderBy: { finishedAt: "desc" } });
    return run?.finishedAt ?? null;
  }, SNAPSHOT_STALE_MS);
}

const NO_SYNC = "No data has been synced yet. An admin can press “Refresh data” once the BigQuery mapping is configured.";

export const syncedAnalytics: AnalyticsPort = {
  kind: "synced",

  async listClients() {
    // Independent queries: start both, so this costs one round trip instead of two.
    const [at, rows] = await Promise.all([lastSync(), cached("snap:clients", SNAPSHOT_TTL_MS, () => db.syncClient.findMany({ orderBy: { name: "asc" } }), SNAPSHOT_STALE_MS)]);
    if (!at) return unavailable(NO_SYNC);
    const data: ClientSummary[] = rows.map((r) => ({ ...r }));
    return { status: "ok", data, source: "synced", asOf: at.toISOString() };
  },

  async getClientPeriodRows(clientIds) {
    const [at, rows] = await Promise.all([lastSync(), cached(`snap:periods:${clientIds ? [...clientIds].sort().join(",") : "*"}`, SNAPSHOT_TTL_MS, () => db.syncClientPeriod.findMany({ where: clientIds ? { clientId: { in: clientIds } } : undefined }), SNAPSHOT_STALE_MS)]);
    if (!at) return unavailable(NO_SYNC);
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
