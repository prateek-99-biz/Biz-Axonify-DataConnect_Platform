/**
 * Seeds metric definitions (idempotent). With DATA_ADAPTER=mock it also materialises the mock clients into
 * ClientMapping so notes/tasks have stable foreign keys. Never seeds fake data in production.
 */
import { PrismaClient } from "@prisma/client";
import { METRIC_DEFINITIONS } from "../src/server/metrics/definitions";
import { mockAnalytics } from "../src/server/data/adapters/mock";

const db = new PrismaClient();

async function main() {
  for (const d of METRIC_DEFINITIONS) {
    await db.metricDefinition.upsert({
      where: { key: d.key },
      create: { key: d.key, name: d.name, description: d.description, formula: d.formula, unit: d.unit, status: d.status },
      update: { name: d.name, description: d.description, formula: d.formula, unit: d.unit, status: d.status },
    });
  }
  if (process.env.NODE_ENV === "production") return;
  if ((process.env.DATA_ADAPTER ?? "mock") === "mock") {
    const res = await mockAnalytics.listClients();
    if (res.status === "ok") {
      for (const c of res.data) {
        await db.clientMapping.upsert({
          where: { id: c.id },
          create: { id: c.id, displayName: c.name, industry: c.industry, csmEmail: c.csmEmail, axonifyTenantId: c.axonifyTenantId, salesforceAccountId: c.salesforceAccountId },
          update: { displayName: c.name, industry: c.industry, csmEmail: c.csmEmail },
        });
      }
    }
  }
}

main().finally(() => db.$disconnect());
