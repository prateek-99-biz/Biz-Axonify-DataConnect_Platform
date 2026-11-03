import { describe, expect, it } from "vitest";
import { COLUMNS, parseAccounts, parseCsv, toCsv } from "./salesforce-accounts";

const HEADER = COLUMNS.join(",");

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("drops blank lines", () => expect(parseCsv("a\n\n,\nb\n")).toEqual([["a"], ["b"]]));
});

describe("parseAccounts", () => {
  const row = "384,Adidas,001A,Retail,GCC,Sarah K.,sarah@bizgroup.ae,800,12000,usd,2025-01-01,2026-12-31";

  it("reads a valid row", () => {
    const r = parseAccounts(`${HEADER}\n${row}\n`);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ clientId: "384", salesforceAccountId: "001A", licenses: 800, licenseValue: 12000, currency: "USD", renewalDate: "2026-12-31", csmEmail: "sarah@bizgroup.ae" });
  });

  it("skips rows that carry only an id and name, as in the blank template", () => {
    const r = parseAccounts(`${HEADER}\n384,Adidas,,,,,,,,,,\n`);
    expect(r).toMatchObject({ rows: [], errors: [], blank: 1 });
  });

  it("reports problems with the sheet's row number and still keeps the good rows", () => {
    const r = parseAccounts(`${HEADER}\n${row}\n269,Etihad,,,,,not-an-email,12.5,-3,AED,31/12/2026,\n`);
    expect(r.rows).toHaveLength(1);
    expect(r.errors[0]).toMatch(/^Row 3:/);
    for (const part of ["csm_email", "licenses", "license_value", "contract_start"]) expect(r.errors[0]).toContain(part);
  });

  it("rejects duplicate ids, duplicate Salesforce ids and unknown clients", () => {
    const r = parseAccounts(`${HEADER}\n${row}\n${row}\n999,X,001A,,,,,,,,,\n`, new Set(["384"]));
    expect(r.rows).toHaveLength(1);
    expect(r.errors.join(" ")).toMatch(/more than once/);
    expect(r.errors.join(" ")).toMatch(/not in the client list/);
  });

  it("rejects impossible dates and a renewal before the start", () => {
    const r = parseAccounts(`${HEADER}\n1,A,,,,,,,,,2026-02-30,\n2,B,,,,,,,,,2026-05-01,2026-01-01\n`);
    expect(r.rows).toEqual([]);
    expect(r.errors).toHaveLength(2);
  });

  it("needs a client_id column and accepts columns in any order", () => {
    expect(parseAccounts("name\nx\n").errors[0]).toMatch(/client_id/);
    expect(parseAccounts("licenses,client_id\n50,7\n").rows[0]).toMatchObject({ clientId: "7", licenses: 50 });
  });

  it("accepts thousands separators in numbers", () => expect(parseAccounts("client_id,license_value\n1,\"12,500.50\"\n").rows[0].licenseValue).toBe(12500.5));
});

describe("toCsv", () => {
  it("round-trips through parseAccounts, quoting cells that need it", () => {
    const text = toCsv([{ client_id: "1", client_name: 'A, "B"', licenses: 10, renewal_date: "2026-01-31" }]);
    expect(parseCsv(text)[1][1]).toBe('A, "B"');
    expect(parseAccounts(text).rows[0]).toMatchObject({ clientId: "1", licenses: 10, renewalDate: "2026-01-31" });
  });
});
