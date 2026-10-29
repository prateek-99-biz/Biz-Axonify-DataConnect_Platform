/**
 * Daily/manual sync: BigQuery reporting tables (named in config/bigquery-mapping.json) -> Postgres summaries.
 * Used by both `npm run sync` (scheduled) and the admin "Refresh data" button. Importable outside Next.js.
 * A failed sync never touches existing data.
 */
import { db } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { bigqueryAnalytics } from "@/server/data/adapters/bigquery";
import { bqConfig, fetchDashboards } from "@/server/dashboard/bigquery/load";
import type { DashboardData } from "@/server/dashboard/types";
import { SECTION_NAMES, splitDashboard } from "@/server/dashboard/sections";

const STALE_RUN_MS = 10 * 60_000;
const COOLDOWN_MS = 60_000;

export type SyncOutcome =
  | { ok: true; clients: number; rows: number; finishedAt: string }
  | { ok: false; reason: string; kind: "busy" | "cooldown" | "unavailable" | "error" };

export async function runSync(triggeredBy: string): Promise<SyncOutcome> {
  const now = Date.now();
  const recent = await db.syncRun.findFirst({ orderBy: { startedAt: "desc" } });
  if (recent?.status === "running" && now - recent.startedAt.getTime() < STALE_RUN_MS) {
    return { ok: false, kind: "busy", reason: "A refresh is already running." };
  }
  if (recent?.finishedAt && now - recent.finishedAt.getTime() < COOLDOWN_MS) {
    return { ok: false, kind: "cooldown", reason: "Data was refreshed less than a minute ago. Try again shortly." };
  }

  const run = await db.syncRun.create({ data: { status: "running", triggeredBy } });
  const fail = async (kind: "unavailable" | "error", reason: string): Promise<SyncOutcome> => {
    await db.syncRun.update({ where: { id: run.id }, data: { status: "failed", finishedAt: new Date(), message: reason.slice(0, 500) } });
    return { ok: false, kind, reason };
  };

  try {
    const [clients, rows] = await Promise.all([bigqueryAnalytics.listClients(), bigqueryAnalytics.getClientPeriodRows()]);
    if (clients.status !== "ok") return fail("unavailable", clients.reason);
    if (rows.status !== "ok") return fail("unavailable", rows.reason);

    // Guard against wiping good data with an empty/broken source.
    if (clients.data.length === 0 || rows.data.length === 0) return fail("error", "The source returned no rows; existing data was kept.");

    // Dashboard datasets are read before anything is written so a failed query leaves existing data untouched.
    const cfg = bqConfig();
    let dashboards: Map<string, DashboardData> | null = null;
    if (cfg) {
      const tenants = clients.data.flatMap((c) => { const id = Number(c.axonifyTenantId); return Number.isInteger(id) && id > 0 ? [{ tenantId: id, clientId: c.id, name: c.name }] : []; });
      const res = await fetchDashboards(cfg, tenants);
      if (res.status !== "ok") return fail("unavailable", res.reason);
      dashboards = res.data;
    }

    let skipped = 0;
    await db.$transaction(async (tx) => {
      await tx.syncClientPeriod.deleteMany();
      await tx.syncClient.deleteMany();
      await tx.syncClient.createMany({ data: clients.data });
      await tx.syncClientPeriod.createMany({ data: rows.data });
      if (dashboards) {
        // A tenant whose query returned nothing keeps its previous snapshot instead of being replaced by an empty one.
        const usable = [...dashboards].filter(([, d]) => d.months.length > 0);
        await tx.syncDashboard.deleteMany({ where: { clientId: { in: usable.map(([clientId]) => clientId) } } });
        await tx.syncDashboardPart.deleteMany({ where: { clientId: { in: usable.map(([clientId]) => clientId) } } });
        const split = usable.map(([clientId, d]) => ({ clientId, ...splitDashboard(d) }));
        await tx.syncDashboard.createMany({ data: split.map((s) => ({ clientId: s.clientId, payload: s.core as unknown as Prisma.InputJsonValue })) });
        await tx.syncDashboardPart.createMany({
          data: split.flatMap((s) => SECTION_NAMES.map((section) => ({ clientId: s.clientId, section, payload: s.parts[section] as Prisma.InputJsonValue }))),
        });
        skipped = dashboards.size - usable.length;
      }
      for (const c of clients.data) {
        await tx.clientMapping.upsert({
          where: { id: c.id },
          create: { id: c.id, displayName: c.name, industry: c.industry, csmEmail: c.csmEmail, axonifyTenantId: c.axonifyTenantId, salesforceAccountId: c.salesforceAccountId },
          update: { displayName: c.name, industry: c.industry, csmEmail: c.csmEmail },
        });
      }
    }, { timeout: 120_000 });

    const finishedAt = new Date();
    await db.syncRun.update({ where: { id: run.id }, data: { status: "ok", finishedAt, clientCount: clients.data.length, rowCount: rows.data.length, message: skipped ? `${skipped} client dashboard(s) had no data; their previous snapshot was kept.` : null } });
    return { ok: true, clients: clients.data.length, rows: rows.data.length, finishedAt: finishedAt.toISOString() };
  } catch (e) {
    return fail("error", e instanceof Error ? e.message : "Unknown error");
  }
}
