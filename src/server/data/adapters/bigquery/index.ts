/**
 * Live BigQuery adapter. It reads ONLY the optimized reporting tables, never DataConnect views directly,
 * and every table/column name comes from the mapping file (config/bigquery-mapping.json). No table names
 * are assumed in code. Unmapped capabilities return `unavailable` with an explanation instead of mock data.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import type { AnalyticsPort, ClientPeriodRow, ClientSummary, Result } from "../../ports";
import { bqConfig, runQuery } from "@/server/dashboard/bigquery/load";

const asNum = (v: unknown) => { const x = v && typeof v === "object" && "value" in v ? (v as { value: unknown }).value : v; const n = Number(x); return Number.isFinite(n) ? n : 0; };

const col = z.string().min(1);
const mappingSchema = z.object({
  clients: z
    .object({
      table: col,
      columns: z.object({
        id: col, name: col, industry: col, csmEmail: col, csmName: col, axonifyTenantId: col, salesforceAccountId: col,
      }),
    })
    .optional(),
  clientPeriod: z
    .object({
      table: col,
      columns: z.object({
        clientId: col, period: col, registeredUsers: col, activeUsers: col, trainingUsers: col,
        knowledgeLearners: col, avgKnowledge: col, retainedUsers: col,
        previousActiveUsers: col, sessions: col, featuresAvailable: col, featuresUsed: col,
      }),
    })
    .optional(),
});
type Mapping = z.infer<typeof mappingSchema>;

const unavailable = (reason: string): Result<never> => ({ status: "unavailable", reason, source: "bigquery" });

let cached: Mapping | null | undefined;
function loadMapping(): Mapping | null {
  if (cached !== undefined) return cached;
  try {
    cached = mappingSchema.parse(JSON.parse(readFileSync(process.env.BQ_MAPPING_FILE ?? "config/bigquery-mapping.json", "utf8")));
  } catch {
    cached = null;
  }
  return cached;
}

// Identifiers come from trusted config but are still validated before interpolation.
const ident = (s: string) => {
  if (!/^[A-Za-z0-9_.\-`]+$/.test(s)) throw new Error(`Unsafe BigQuery identifier in mapping: ${s}`);
  return s;
};

async function query<T>(sql: string): Promise<T[]> {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const bq = new BigQuery({ projectId: process.env.BQ_PROJECT_ID });
  const [rows] = await bq.query({ query: sql });
  return rows as T[];
}

export const bigqueryAnalytics: AnalyticsPort = {
  kind: "bigquery",

  async listClients() {
    const m = loadMapping()?.clients;
    if (!m) {
      const cfg = bqConfig();
      if (!cfg || cfg.tenants.length === 0) return unavailable("Set BQ_PROJECT_ID and BQ_TENANT_IDS, or fill in `clients` in the BigQuery mapping file.");
      const rows = await runQuery(cfg, "clients", cfg.tenants);
      const data: ClientSummary[] = rows.map((r) => ({
        id: String(asNum(r.id)), name: String(r.name), industry: "Unknown", csmEmail: "", csmName: "",
        axonifyTenantId: String(asNum(r.id)), salesforceAccountId: null,
      }));
      return { status: "ok", data, source: "bigquery", asOf: new Date().toISOString() };
    }
    const c = m.columns;
    const rows = await query<Record<string, string | null>>(
      `SELECT ${Object.values(c).map(ident).join(", ")} FROM ${ident(m.table)}`,
    );
    const data: ClientSummary[] = rows.map((r) => ({
      id: String(r[c.id]), name: String(r[c.name]), industry: String(r[c.industry] ?? "Unknown"),
      csmEmail: String(r[c.csmEmail] ?? ""), csmName: String(r[c.csmName] ?? ""),
      axonifyTenantId: r[c.axonifyTenantId] ?? null, salesforceAccountId: r[c.salesforceAccountId] ?? null,
    }));
    return { status: "ok", data, source: "bigquery", asOf: new Date().toISOString() };
  },

  async getClientPeriodRows(clientIds) {
    const m = loadMapping()?.clientPeriod;
    if (!m) {
      const cfg = bqConfig();
      if (!cfg || cfg.tenants.length === 0) return unavailable("Set BQ_PROJECT_ID and BQ_TENANT_IDS, or fill in `clientPeriod` in the BigQuery mapping file.");
      const tenants = clientIds?.length ? clientIds.map(Number).filter(Number.isInteger) : cfg.tenants;
      const rows = await runQuery(cfg, "clientPeriod", tenants);
      const data: ClientPeriodRow[] = rows.map((r) => ({
        clientId: String(asNum(r.tenant_id)), period: String(r.period), registeredUsers: asNum(r.registered_users), activeUsers: asNum(r.active_users),
        trainingUsers: asNum(r.training_users), knowledgeLearners: asNum(r.knowledge_learners),
        avgKnowledge: r.avg_knowledge == null ? null : Math.min(1, asNum(r.avg_knowledge) / 100), retainedUsers: asNum(r.retained_users),
        previousActiveUsers: asNum(r.previous_active_users), sessions: asNum(r.sessions), featuresAvailable: 0, featuresUsed: 0,
      }));
      return { status: "ok", data, source: "bigquery", asOf: new Date().toISOString() };
    }
    const c = m.columns;
    const select = (Object.keys(c) as (keyof typeof c)[]).map((k) => `${ident(c[k])} AS ${k}`).join(", ");
    const where = clientIds?.length ? `WHERE ${ident(c.clientId)} IN UNNEST(@ids)` : "";
    const { BigQuery } = await import("@google-cloud/bigquery");
    const bq = new BigQuery({ projectId: process.env.BQ_PROJECT_ID });
    const [rows] = await bq.query({
      query: `SELECT ${select} FROM ${ident(m.table)} ${where}`,
      params: clientIds?.length ? { ids: clientIds } : undefined,
    });
    return { status: "ok", data: rows as ClientPeriodRow[], source: "bigquery", asOf: new Date().toISOString() };
  },

  async getTeamTree() {
    return unavailable("Team hierarchy is not yet mapped to a BigQuery reporting table.");
  },
  async getUsers() {
    return unavailable("User-level data is not yet mapped to a BigQuery reporting table.");
  },
  async getSourceCoverage() {
    return unavailable("Source coverage / freshness is not yet mapped to a BigQuery reporting table.");
  },
};
