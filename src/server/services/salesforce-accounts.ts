import "server-only";
import { db } from "@/server/db";
import { clearCache } from "@/server/cache";
import { getAdapters } from "@/server/data";
import { fromDb } from "@/server/data/salesforce-overlay";
import { parseAccounts, toCsv, type AccountInput } from "@/lib/salesforce-accounts";

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
