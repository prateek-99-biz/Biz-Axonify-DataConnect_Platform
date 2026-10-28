import type { Result } from "@/server/data/ports";
import { assembleDashboard, type Row, type RowSet } from "./assemble";
import { buildSql, type QueryName, type Source } from "./queries";
import type { DashboardData } from "../types";

export const DEFAULT_DATASET = "axonify___bizgroup_emea";

export interface BqConfig extends Source { tenants: number[] }

/** Project, dataset and tenant list come from env; nothing is assumed about the project. */
export function bqConfig(): BqConfig | null {
  const project = process.env.BQ_PROJECT_ID?.trim();
  if (!project) return null;
  const tenants = (process.env.BQ_TENANT_IDS ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  return { project, dataset: process.env.BQ_DATASET?.trim() || DEFAULT_DATASET, tenants };
}

export async function runQuery(cfg: BqConfig, name: QueryName, tenants: number[]): Promise<Row[]> {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const bq = new BigQuery({ projectId: cfg.project });
  try {
    const [rows] = await bq.query({ query: buildSql(name, cfg), params: { tenants }, types: { tenants: ["INT64"] } });
    return rows as Row[];
  } catch (e) {
    throw new Error(`BigQuery query "${name}" failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const DATASETS = ["teamMonthly", "knowledgeAccount", "topics", "frequency", "progress", "matrix", "usageMonthly", "platformAccess", "hours", "features", "deliveryGroups", "deliverySummary"] as const;

/** Reads every dashboard dataset for the given tenants and returns one DashboardData per tenant, keyed by tenant id. */
export async function fetchDashboards(cfg: BqConfig, tenants: { tenantId: number; clientId: string; name: string }[]): Promise<Result<Map<string, DashboardData>>> {
  if (tenants.length === 0) return { status: "unavailable", reason: "No tenants are configured. Set BQ_TENANT_IDS.", source: "bigquery" };
  const ids = tenants.map((t) => t.tenantId);
  const results = await Promise.all(DATASETS.map(async (name) => [name, await runQuery(cfg, name, ids)] as const));
  const all = Object.fromEntries(results) as RowSet;
  const asOf = new Date().toISOString();

  const out = new Map<string, DashboardData>();
  for (const t of tenants) {
    const mine = Object.fromEntries(DATASETS.map((n) => [n, all[n].filter((r) => Number((r.tenant_id as { value?: unknown })?.value ?? r.tenant_id) === t.tenantId)])) as RowSet;
    out.set(t.clientId, assembleDashboard(t.clientId, t.name, mine, asOf));
  }
  return { status: "ok", data: out, source: "bigquery", asOf };
}
