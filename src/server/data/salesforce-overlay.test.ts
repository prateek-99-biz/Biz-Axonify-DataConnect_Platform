import { describe, expect, it } from "vitest";
import { applySalesforce, fromDb, type SalesforceRow } from "./salesforce-overlay";
import type { ClientSummary } from "./ports";

const client = (id: string, over: Partial<ClientSummary> = {}): ClientSummary => ({ id, name: `c${id}`, industry: "Unknown", csmEmail: "", csmName: "", axonifyTenantId: id, salesforceAccountId: null, ...over });
const acct = (over: Partial<SalesforceRow> = {}): SalesforceRow => ({ clientId: "1", salesforceAccountId: "001A", industry: "Retail", region: "GCC", csmName: "Sarah K.", csmEmail: "sarah@bizgroup.ae", licenses: 800, licenseValue: 12000, currency: "USD", contractStart: "2025-01-01", renewalDate: "2026-12-31", ...over });

describe("applySalesforce", () => {
  it("fills industry, CSM, account id and commercial facts for matching clients only", () => {
    const [a, b] = applySalesforce([client("1"), client("2")], [acct()]);
    expect(a).toMatchObject({ industry: "Retail", csmName: "Sarah K.", csmEmail: "sarah@bizgroup.ae", salesforceAccountId: "001A", commercial: { licenses: 800, renewalDate: "2026-12-31" } });
    expect(b.commercial).toBeUndefined();
    expect(b.industry).toBe("Unknown");
  });
  it("keeps what Axonify supplied where Salesforce is blank", () => {
    const [a] = applySalesforce([client("1", { industry: "Aviation", csmName: "Ali" })], [acct({ industry: null, csmName: null, salesforceAccountId: null })]);
    expect(a).toMatchObject({ industry: "Aviation", csmName: "Ali" });
  });
  it("returns the same list when nothing has been loaded", () => {
    const list = [client("1")];
    expect(applySalesforce(list, [])).toBe(list);
  });
});

describe("fromDb", () => {
  it("turns decimals and dates into plain values", () => {
    const r = fromDb({ ...acct(), licenseValue: { toString: () => "12000.50" }, contractStart: new Date("2025-01-01T00:00:00Z"), renewalDate: null });
    expect(r).toMatchObject({ licenseValue: 12000.5, contractStart: "2025-01-01", renewalDate: null });
  });
});
