import type { CrmPort } from "../../ports";

/**
 * Salesforce adapter placeholder (Phase 3). Object and field mappings are not yet agreed, so nothing is
 * queried; callers receive an explicit `unavailable` result.
 */
export const salesforceCrm: CrmPort = {
  kind: "salesforce",
  async getAccount() {
    return {
      status: "unavailable",
      reason: "Salesforce integration is not configured (Phase 3). Provide credentials and config/salesforce-mapping.json.",
      source: "salesforce",
    };
  },
};
