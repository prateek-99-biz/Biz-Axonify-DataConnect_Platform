// Validates every dashboard query against BigQuery without running it (dry run: free, reads no data).
// Usage: npm run bq:check. Needs BQ_PROJECT_ID, BQ_TENANT_IDS and Google credentials.
import { BigQuery } from "@google-cloud/bigquery";
import { QUERIES, buildSql, type QueryName } from "../src/server/dashboard/bigquery/queries";
import { bqConfig } from "../src/server/dashboard/bigquery/load";

async function main() {
  const cfg = bqConfig();
  if (!cfg || cfg.tenants.length === 0) {
    console.error("Set BQ_PROJECT_ID and BQ_TENANT_IDS first.");
    process.exitCode = 1;
    return;
  }
  const bq = new BigQuery({ projectId: cfg.project });
  let failed = 0;
  for (const name of Object.keys(QUERIES) as QueryName[]) {
    try {
      const [job] = await bq.createQueryJob({ query: buildSql(name, cfg), params: { tenants: cfg.tenants }, types: { tenants: ["INT64"] }, dryRun: true });
      const gb = Number(job.metadata?.statistics?.totalBytesProcessed ?? 0) / 1e9;
      console.log(`ok    ${name.padEnd(16)} would scan ${gb.toFixed(2)} GB`);
    } catch (e) {
      failed++;
      console.error(`FAIL  ${name.padEnd(16)} ${e instanceof Error ? e.message.split("\n")[0] : e}`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

void main();
