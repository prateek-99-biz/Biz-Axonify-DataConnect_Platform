import type { ClientSummary } from "./ports";

/** A stored Salesforce account row, with dates as YYYY-MM-DD and numbers as plain numbers. */
export interface SalesforceRow {
  clientId: string;
  salesforceAccountId: string | null;
  industry: string | null;
  region: string | null;
  csmName: string | null;
  csmEmail: string | null;
  licenses: number | null;
  licenseValue: number | null;
  currency: string;
  contractStart: string | null;
  renewalDate: string | null;
}

interface DbRow extends Omit<SalesforceRow, "licenseValue" | "contractStart" | "renewalDate"> {
  licenseValue: { toString(): string } | null;
  contractStart: Date | null;
  renewalDate: Date | null;
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export const fromDb = (r: DbRow): SalesforceRow => ({
  ...r,
  licenseValue: r.licenseValue == null ? null : Number(r.licenseValue.toString()),
  contractStart: day(r.contractStart),
  renewalDate: day(r.renewalDate),
});

/**
 * Lays the Salesforce facts over the Axonify client list. A value from Salesforce wins when it is filled in; an empty one
 * leaves what Axonify supplied (which, for CSM and industry, is usually nothing). The sync never touches the stored rows.
 */
export function applySalesforce(clients: ClientSummary[], accounts: readonly SalesforceRow[]): ClientSummary[] {
  if (accounts.length === 0) return clients;
  const byId = new Map(accounts.map((a) => [a.clientId, a]));
  return clients.map((c) => {
    const a = byId.get(c.id);
    if (!a) return c;
    return {
      ...c,
      industry: a.industry || c.industry,
      csmName: a.csmName || c.csmName,
      csmEmail: a.csmEmail || c.csmEmail,
      salesforceAccountId: a.salesforceAccountId ?? c.salesforceAccountId,
      commercial: { licenses: a.licenses, licenseValue: a.licenseValue, currency: a.currency, region: a.region, contractStart: a.contractStart, renewalDate: a.renewalDate },
    };
  });
}
