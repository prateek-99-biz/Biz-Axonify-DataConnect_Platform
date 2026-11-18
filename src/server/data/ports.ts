/**
 * Integration interfaces. UI and services depend only on these ports; adapters
 * (mock | bigquery | salesforce) implement them. Every response carries its
 * provenance so the UI can label mock data and explain unavailable sources.
 */

export type SourceKind = "mock" | "bigquery" | "synced" | "salesforce";

export type Result<T> =
  | { status: "ok"; data: T; source: SourceKind; asOf: string }
  | { status: "unavailable"; reason: string; source: SourceKind };

/** Commercial facts about a client from Salesforce. Dates are written YYYY-MM-DD. */
export interface ClientCommercial {
  licenses: number | null;
  licenseValue: number | null;
  currency: string;
  region: string | null;
  contractStart: string | null;
  renewalDate: string | null;
}

export interface ClientSummary {
  /** Unified client key (ClientMapping.id). */
  id: string;
  name: string;
  industry: string;
  csmEmail: string;
  csmName: string;
  axonifyTenantId: string | null;
  salesforceAccountId: string | null;
  /** Present once the client's row has been loaded from the Salesforce CSV. */
  commercial?: ClientCommercial | null;
}

/** One row per client per calendar quarter (target shape of the reporting table). */
export interface ClientPeriodRow {
  clientId: string;
  /** e.g. 2026-Q3 */
  period: string;
  registeredUsers: number;
  activeUsers: number;
  /** Active users with at least one training session in the period (numerator of participation). */
  trainingUsers: number;
  /** Learners that have knowledge scores (weight for averaging avgKnowledge across clients). */
  knowledgeLearners: number;
  /** Average current knowledge, 0-1 (values above 1 are treated as percentages). Null when no learner has a score. */
  avgKnowledge: number | null;
  /** Users active in this quarter that were also active in the previous quarter. */
  retainedUsers: number;
  /** Active users in the previous quarter (denominator for retention). */
  previousActiveUsers: number;
  sessions: number;
  featuresAvailable: number;
  featuresUsed: number;
  /**
   * Active and training users of each month in the quarter, added up (each month's distinct users). Participation uses
   * these when present, as Axonify's Participation report does: the monthly share, not anyone who trained once in the
   * quarter. Filled when the period rows are read, from the monthly rows; absent outside the monthly window.
   */
  monthActiveSum?: number;
  monthTrainingSum?: number;
}

/**
 * One row per client per calendar month: how many people used each Axonify feature, and Max (AI assistant) activity.
 * User counts are distinct users in that month. Months are written YYYY-MM.
 */
export interface ClientMonthRow {
  clientId: string;
  month: string;
  /** Distinct users with an active account (Axonify "Employees"). Denominator for every share on the feature pages. */
  activeUsers: number;
  /** Active users with at least one session in the month (Axonify "Logged in"). */
  loggedInUsers: number;
  trainingUsers: number;
  /** Total seconds spent in the platform. */
  learningSeconds: number;
  /** Questions asked to Max, the people who asked them, questions whose answer cited the client's own content, and feedback. */
  maxQueries: number;
  maxUsers: number;
  maxGrounded: number;
  maxRated: number;
  maxNegative: number;
  gameUsers: number;
  gamesPlayed: number;
  rewardUsers: number;
  recognitionsSent: number;
  recognitionUsers: number;
  broadcastsSent: number;
  commsReachUsers: number;
  commsResponseUsers: number;
  chatMessages: number;
  chatUsers: number;
  communityUsers: number;
  discoverUsers: number;
  tasksCompleted: number;
  taskUsers: number;
  formsSubmitted: number;
  formUsers: number;
  eventAttendees: number;
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
  /** Monthly feature and Max usage for the given clients (all clients when omitted). */
  getClientMonthRows(clientIds?: string[]): Promise<Result<ClientMonthRow[]>>;
  getTeamTree(clientId: string, period: string): Promise<Result<TeamNode[]>>;
  getUsers(clientId: string, period: string): Promise<Result<UserRow[]>>;
  getSourceCoverage(): Promise<Result<SourceCoverageRow[]>>;
}

export interface CrmAccount {
  salesforceAccountId: string;
  contractStart: string | null;
  contractEnd: string | null;
  arr: number | null;
  /** Currency of `arr`, when known. */
  currency?: string | null;
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
