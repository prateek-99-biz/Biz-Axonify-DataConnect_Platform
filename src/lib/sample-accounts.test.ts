import { describe, expect, it } from "vitest";
import { buildSampleAccounts, isSampleId, SAMPLE_PREFIX } from "./sample-accounts";
import { COLUMNS, parseAccounts, toCsv } from "./salesforce-accounts";

const clients = Array.from({ length: 16 }, (_, i) => ({ id: String(100 + i), name: `client-${i}` }));
const TODAY = "2026-11-02";

describe("buildSampleAccounts", () => {
  const rows = buildSampleAccounts(clients, TODAY);

  it("gives every client a row, marked as sample data", () => {
    expect(rows).toHaveLength(16);
    expect(rows.every((r) => isSampleId(r.salesforceAccountId) && r.salesforceAccountId!.startsWith(SAMPLE_PREFIX))).toBe(true);
    expect(new Set(rows.map((r) => r.salesforceAccountId)).size).toBe(16);
  });

  it("spreads clients over CSMs so each has between three and five", () => {
    const per = new Map<string, number>();
    for (const r of rows) per.set(r.csmEmail!, (per.get(r.csmEmail!) ?? 0) + 1);
    expect(per.size).toBe(4);
    for (const n of per.values()) expect(n).toBeGreaterThanOrEqual(3), expect(n).toBeLessThanOrEqual(5);
  });

  it("puts renewals in the future and contracts before them", () => {
    for (const r of rows) {
      expect(r.renewalDate! > TODAY).toBe(true);
      expect(r.contractStart! < r.renewalDate!).toBe(true);
    }
  });

  it("passes the importer's own checks", () => {
    const csv = toCsv(rows.map((r) => ({
      client_id: r.clientId, salesforce_account_id: r.salesforceAccountId, industry: r.industry, region: r.region, csm_name: r.csmName, csm_email: r.csmEmail,
      licenses: r.licenses, license_value: r.licenseValue, currency: r.currency, contract_start: r.contractStart, renewal_date: r.renewalDate,
    })));
    const parsed = parseAccounts(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(16);
    expect(COLUMNS.length).toBeGreaterThan(0);
  });

  it("is the same for the same input", () => expect(buildSampleAccounts(clients, TODAY)).toEqual(rows));
});

describe("isSampleId", () => {
  it("recognises only the sample prefix", () => {
    expect(isSampleId("MOCK-SF-007")).toBe(true);
    expect(isSampleId("001A000001")).toBe(false);
    expect(isSampleId(null)).toBe(false);
  });
});
