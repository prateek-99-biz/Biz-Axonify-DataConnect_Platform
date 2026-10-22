// Run daily from a scheduler: `npm run sync`. Exit code 1 on failure so the scheduler can alert.
import { runSync } from "../src/server/sync";
import { db } from "../src/server/db";

runSync("scheduler")
  .then((r) => {
    console.log(r.ok ? `Synced ${r.clients} clients, ${r.rows} rows at ${r.finishedAt}` : `Sync failed (${r.kind}): ${r.reason}`);
    process.exitCode = r.ok ? 0 : 1;
  })
  .finally(() => db.$disconnect());
