import { db } from "@/server/db";
import type { CrmPort } from "../../ports";
import { fromDb } from "../../salesforce-overlay";

/**
 * Salesforce adapter. The live link (Phase 3) is not built, so this reads the static account rows an admin loads from a CSV
 * in Settings. When the live link arrives it replaces this lookup and nothing that calls `getAccount` changes.
 */
export const salesforceCrm: CrmPort = {
  kind: "salesforce",
  async getAccount(salesforceAccountId) {
    const row = await db.salesforceAccount.findUnique({ where: { salesforceAccountId } });
    if (!row) {
      return { status: "unavailable", reason: "No Salesforce data has been loaded for this account yet. An admin can import it from Settings.", source: "salesforce" };
    }
    const a = fromDb(row);
    return {
      status: "ok",
      source: "salesforce",
      asOf: row.updatedAt.toISOString(),
      data: { salesforceAccountId, contractStart: a.contractStart, contractEnd: a.renewalDate, arr: a.licenseValue },
    };
  },
};
