/**
 * Which people the Insights shares are worked out over, matching the toggle on AdminZone's Participation report.
 * Kept free of other imports so the browser-side toggle can use it.
 *   "all"      every user with an active account (AdminZone's All Users). The default: broadcasts, chat and the other
 *              features reach everyone, not just people in training programs.
 *   "programs" only users in active training programs (AdminZone's default view, and the client dashboards' basis).
 */
export type UserBasis = "all" | "programs";

/** Cookie that remembers the choice between pages. */
export const USER_BASIS_COOKIE = "ci_users";

export const parseUserBasis = (v: unknown): UserBasis => (v === "programs" ? "programs" : "all");

export interface BasisGap {
  clientId: string;
  month: string;
  allActive: number;
  programActive: number;
  /** Active users who are not in any training program. */
  outside: number;
  allEngagement: number | null;
  programEngagement: number | null;
}
