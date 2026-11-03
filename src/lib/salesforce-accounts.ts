import { emailProblem } from "./account-input";

/** The CSV an admin loads in Settings. One row per client; `client_id` is the Axonify tenant ID shown in the Clients list. */
export const COLUMNS = [
  "client_id", "client_name", "salesforce_account_id", "industry", "region", "csm_name", "csm_email",
  "licenses", "license_value", "currency", "contract_start", "renewal_date",
] as const;

export interface AccountInput {
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

export interface ParsedAccounts { rows: AccountInput[]; errors: string[]; blank: number }

/** Splits CSV text into rows of cells. Handles quoted cells (commas, doubled quotes, line breaks), CRLF and a leading BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const isoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/**
 * Checks every row and keeps the valid ones. A row with only an ID and name (the downloaded template before it is filled in)
 * counts as blank and is skipped. Problems name the row, using the sheet's own numbering (the header is row 1).
 */
export function parseAccounts(text: string, knownClientIds?: ReadonlySet<string>): ParsedAccounts {
  const table = parseCsv(text);
  const out: ParsedAccounts = { rows: [], errors: [], blank: 0 };
  if (table.length === 0) { out.errors.push("The file is empty."); return out; }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const at = (name: string) => header.indexOf(name);
  if (at("client_id") < 0) { out.errors.push("The first row must be a header that includes client_id."); return out; }
  const unknown = header.filter((h) => h && !(COLUMNS as readonly string[]).includes(h));
  if (unknown.length) out.errors.push(`Ignored unknown columns: ${unknown.join(", ")}.`);

  const seen = new Set<string>();
  const seenSf = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const n = i + 2;
    const get = (name: string) => (at(name) < 0 ? "" : (cells[at(name)] ?? "").trim());
    const clientId = get("client_id");
    const filled = COLUMNS.filter((c) => c !== "client_id" && c !== "client_name" && get(c) !== "");
    if (!clientId) { out.errors.push(`Row ${n}: client_id is empty.`); return; }
    if (filled.length === 0) { out.blank++; return; }

    const problems: string[] = [];
    if (seen.has(clientId)) problems.push(`client_id ${clientId} appears more than once`);
    if (knownClientIds && !knownClientIds.has(clientId)) problems.push(`client_id ${clientId} is not in the client list`);
    const sf = get("salesforce_account_id");
    if (sf && seenSf.has(sf)) problems.push(`salesforce_account_id ${sf} is used by more than one row`);
    const email = get("csm_email").toLowerCase();
    if (email && emailProblem(email)) problems.push("csm_email is not a valid email address");

    const num = (name: string, whole: boolean) => {
      const raw = get(name).replace(/[, ]/g, "");
      if (raw === "") return null;
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 0 || (whole && !Number.isInteger(v))) { problems.push(`${name} must be ${whole ? "a whole number" : "a number"} of 0 or more`); return null; }
      return v;
    };
    const date = (name: string) => {
      const v = get(name);
      if (v === "") return null;
      if (!isoDate(v)) { problems.push(`${name} must be a date written YYYY-MM-DD`); return null; }
      return v;
    };
    const licenses = num("licenses", true);
    const licenseValue = num("license_value", false);
    const contractStart = date("contract_start");
    const renewalDate = date("renewal_date");
    const currency = (get("currency") || "USD").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) problems.push("currency must be a three-letter code such as USD or AED");
    if (contractStart && renewalDate && renewalDate < contractStart) problems.push("renewal_date is before contract_start");

    seen.add(clientId);
    if (sf) seenSf.add(sf);
    if (problems.length) { out.errors.push(`Row ${n}: ${problems.join("; ")}.`); return; }
    out.rows.push({
      clientId, salesforceAccountId: sf || null, industry: get("industry") || null, region: get("region") || null,
      csmName: get("csm_name") || null, csmEmail: email || null, licenses, licenseValue, currency, contractStart, renewalDate,
    });
  });
  return out;
}

const cell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV text with the header and one row per entry; used for the downloadable template and for exporting what is loaded. */
export function toCsv(rows: Partial<Record<(typeof COLUMNS)[number], string | number | null>>[]): string {
  return [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
