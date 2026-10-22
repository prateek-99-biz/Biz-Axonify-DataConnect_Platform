import "server-only";
import { db } from "@/server/db";
import { getAdapters } from "@/server/data";
import { HttpError } from "@/server/auth/guard";

/**
 * The unified client dimension (Salesforce Account ID <-> Axonify Tenant ID) is application-owned in Postgres.
 * Rows are created lazily from the analytics client list the first time a note/task is attached.
 */
export async function ensureClientMapping(clientId: string) {
  const existing = await db.clientMapping.findUnique({ where: { id: clientId } });
  if (existing) return existing;
  const res = await getAdapters().analytics.listClients();
  if (res.status !== "ok") throw new HttpError(503, res.reason);
  const c = res.data.find((x) => x.id === clientId);
  if (!c) throw new HttpError(404, "Unknown client");
  return db.clientMapping.create({
    data: {
      id: c.id, displayName: c.name, industry: c.industry, csmEmail: c.csmEmail,
      axonifyTenantId: c.axonifyTenantId, salesforceAccountId: c.salesforceAccountId,
    },
  });
}
