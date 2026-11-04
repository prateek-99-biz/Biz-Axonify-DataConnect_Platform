import "server-only";
import { db } from "@/server/db";
import { cached, clearCache, SNAPSHOT_STALE_MS, SNAPSHOT_TTL_MS } from "@/server/cache";
import { getAdapters } from "@/server/data";
import { fromDb } from "@/server/data/salesforce-overlay";
import { parseAccounts, toCsv, type AccountInput } from "@/lib/salesforce-accounts";
import { buildSampleAccounts, isSampleId, SAMPLE_PREFIX } from "@/lib/sample-accounts";

export interface ImportResult { imported: number; blank: number; errors: string[] }

const toData = (r: AccountInput) => ({
  salesforceAccountId: r.salesforceAccountId, industry: r.industry, region: r.region, csmName: r.csmName, csmEmail: r.csmEmail,
  licenses: r.licenses, licenseValue: r.licenseValue, currency: r.currency,
  contractStart: r.contractStart ? new Date(`${r.contractStart}T00:00:00Z`) : null,
  renewalDate: r.renewalDate ? new Date(`${r.renewalDate}T00:00:00Z`) : null,
});

/** Saves every valid row (a row replaces that client's earlier one, blanks included) and reports the rest. Rows missing from the file are left alone. */
export async function importAccounts(text: string): Promise<ImportResult> {
  const clients = await getAdapters().analytics.listClients();
  const parsed = parseAccounts(text, clients.status === "ok" ? new Set(clients.data.map((c) => c.id)) : undefined);
  const errors = [...parsed.errors];
  const outcomes = await Promise.allSettled(parsed.rows.map((r) => db.salesforceAccount.upsert({ where: { clientId: r.clientId }, create: { clientId: r.clientId, ...toData(r) }, update: toData(r) })));
  let imported = 0;
  outcomes.forEach((o, i) => {
    if (o.status === "fulfilled") imported++;
    else errors.push(`Client ${parsed.rows[i].clientId}: could not be saved. The salesforce_account_id may already belong to another client.`);
  });
  if (imported) clearCache("snap:");
  return { imported, blank: parsed.blank, errors };
}

/** The template and the export are the same file: every client, with whatever has been loaded for it filled in. */
export async function accountsCsv(): Promise<string> {
  const [clients, stored] = await Promise.all([getAdapters().analytics.listClients(), db.salesforceAccount.findMany()]);
  const byId = new Map(stored.map((s) => [s.clientId, fromDb(s)]));
  const names = clients.status === "ok" ? clients.data.map((c) => ({ id: c.id, name: c.name })) : [...byId.keys()].map((id) => ({ id, name: "" }));
  return toCsv(names.map(({ id, name }) => {
    const a = byId.get(id);
    return {
      client_id: id, client_name: name, salesforce_account_id: a?.salesforceAccountId, industry: a?.industry, region: a?.region,
      csm_name: a?.csmName, csm_email: a?.csmEmail, licenses: a?.licenses, license_value: a?.licenseValue, currency: a?.currency,
      contract_start: a?.contractStart, renewal_date: a?.renewalDate,
    };
  }));
}

export async function accountsSummary() {
  const [count, latest] = await Promise.all([db.salesforceAccount.count(), db.salesforceAccount.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } })]);
  return { count, updatedAt: latest?.updatedAt ?? null };
}

/** Counts the made-up rows. Cached briefly because internal pages ask on every view; cleared whenever rows change. */
export function sampleCount(): Promise<number> {
  return cached("snap:sample", SNAPSHOT_TTL_MS, () => db.salesforceAccount.count({ where: { salesforceAccountId: { startsWith: SAMPLE_PREFIX } } }), SNAPSHOT_STALE_MS);
}

/** Fills every client that has no real Salesforce row with made-up data. A client with a real row is left alone. */
export async function loadSampleAccounts(): Promise<{ loaded: number; skipped: number }> {
  const clients = await getAdapters().analytics.listClients();
  if (clients.status !== "ok") return { loaded: 0, skipped: 0 };
  const existing = await db.salesforceAccount.findMany({ select: { clientId: true, salesforceAccountId: true } });
  const real = new Set(existing.filter((e) => !isSampleId(e.salesforceAccountId)).map((e) => e.clientId));
  const all = buildSampleAccounts(clients.data.map((c) => ({ id: c.id, name: c.name })), new Date().toISOString().slice(0, 10));
  const rows = all.filter((r) => !real.has(r.clientId));
  await Promise.all(rows.map((r) => db.salesforceAccount.upsert({ where: { clientId: r.clientId }, create: { clientId: r.clientId, ...toData(r) }, update: toData(r) })));
  clearCache("snap:");
  return { loaded: rows.length, skipped: all.length - rows.length };
}

/** Deletes only the made-up rows, identified by their MOCK-SF- prefix. Real rows are never touched. */
export async function removeSampleAccounts(): Promise<number> {
  const r = await db.salesforceAccount.deleteMany({ where: { salesforceAccountId: { startsWith: SAMPLE_PREFIX } } });
  if (r.count) clearCache("snap:");
  return r.count;
}
