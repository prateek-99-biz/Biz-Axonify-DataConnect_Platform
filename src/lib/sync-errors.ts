export interface SyncFailureHelp { summary: string; fix: string }

/**
 * Turns the raw text of a failed refresh into a plain sentence and what to do about it. Returns null for anything not recognised,
 * so an unknown error is still shown exactly as it came.
 */
export function explainSyncFailure(message: string): SyncFailureHelp | null {
  if (/default credentials|invalid_rapt|invalid_grant|reauth|application-default/i.test(message)) {
    return { summary: "Google sign-in has expired.", fix: "Run gcloud auth application-default login on the computer that runs the refresh, then refresh again." };
  }
  if (/\b403\b|permission|access ?denied|not authorized/i.test(message)) {
    return { summary: "Google denied access to the data.", fix: "Check that the account has BigQuery Data Viewer and BigQuery Job User." };
  }
  if (/ETIMEDOUT|ECONNRESET|ENOTFOUND|timed out|timeout|fetch failed/i.test(message)) {
    return { summary: "The connection timed out.", fix: "Try the refresh again in a few minutes." };
  }
  return null;
}
