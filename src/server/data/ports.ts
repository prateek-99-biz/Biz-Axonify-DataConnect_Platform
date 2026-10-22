/**
 * Integration interfaces. UI and services depend only on these ports; adapters
 * (mock | bigquery | salesforce) implement them. Every response carries its
 * provenance so the UI can label mock data and explain unavailable sources.
 */

export type SourceKind = "mock" | "bigquery" | "synced" | "salesforce";

export type Result<T> =
  | { status: "ok"; data: T; source: SourceKind; asOf: string }
  | { status: "unavailable"; reason: string; source: SourceKind };

export interface ClientSummary {
  /** Unified client key (ClientMapping.id). */
  id: string;
  name: string;
  industry: string;
  csmEmail: string;
  csmName: string;
  axonifyTenantId: string | null;
  salesforceAccountId: string | null;
}

/** One row per client per calendar quarter (target shape of the reporting table). */
export interface ClientPeriodRow {
  clientId: string;
  /** e.g. 2026-Q3 */
  period: string;
  registeredUsers: number;
  activeUsers: number;
  /** Users active in this quarter that were also active in the previous quarter. */
  retainedUsers: number;
  /** Active users in the previous quarter (denominator for retention). */
  previousActiveUsers: number;
  sessions: number;
  featuresAvailable: number;
  featuresUsed: number;
}

export interface TeamNode {
  id: string;
  name: string;
  parentId: string | null;
  registeredUsers: number;
  activeUsers: number;
}

export type UserLifecycle = "new" | "active" | "at_risk" | "dormant" | "never_active";

export interface UserRow {
  id: string;
  /** Display handle only; no PII beyond what Axonify exposes to the reporting layer. */
  displayName: string;
  teamId: string;
  registeredAt: string;
  lastActiveAt: string | null;
  sessionsInPeriod: number;
  lifecycle: UserLifecycle;
}

export interface SourceCoverageRow {
  clientId: string;
  source: string;
  lastLoadedAt: string | null;
  rowCount: number;
  expectedRowCount: number | null;
}

export interface AnalyticsPort {
  readonly kind: SourceKind;
  listClients(): Promise<Result<ClientSummary[]>>;
  /** All quarterly rows for the given clients (all clients when omitted). */
  getClientPeriodRows(clientIds?: string[]): Promise<Result<ClientPeriodRow[]>>;
  getTeamTree(clientId: string, period: string): Promise<Result<TeamNode[]>>;
  getUsers(clientId: string, period: string): Promise<Result<UserRow[]>>;
  getSourceCoverage(): Promise<Result<SourceCoverageRow[]>>;
}

export interface CrmAccount {
  salesforceAccountId: string;
  contractStart: string | null;
  contractEnd: string | null;
  arr: number | null;
}

export interface CrmPort {
  readonly kind: SourceKind;
  getAccount(salesforceAccountId: string): Promise<Result<CrmAccount>>;
}

export class NotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} is not configured`);
  }
}
