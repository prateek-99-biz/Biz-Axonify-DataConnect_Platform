import "server-only";
import type { AnalyticsPort, CrmPort } from "./ports";
import { getEnv } from "@/server/env";
import { mockAnalytics, mockCrm } from "./adapters/mock";
import { syncedAnalytics } from "./adapters/synced";
import { salesforceCrm } from "./adapters/salesforce";

/** Adapter factory. Production can never resolve to mock (enforced in getEnv). */
export function getAdapters(): { analytics: AnalyticsPort; crm: CrmPort } {
  return getEnv().DATA_ADAPTER === "mock"
    ? { analytics: mockAnalytics, crm: mockCrm }
    : { analytics: syncedAnalytics, crm: salesforceCrm };
}
