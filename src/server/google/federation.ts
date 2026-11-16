/**
 * Settings for signing in to Google without a key file or a person (Workload Identity Federation).
 * Vercel hands the function a short-lived token proving which project it is; Google swaps it for a token that acts as a
 * read-only service account. Kept free of imports so it can be unit tested and read by the Settings page.
 */
export interface Federation { projectNumber: string; poolId: string; providerId: string; serviceAccountEmail: string }

const NAMES = {
  projectNumber: "GCP_PROJECT_NUMBER",
  poolId: "GCP_WORKLOAD_IDENTITY_POOL_ID",
  providerId: "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
  serviceAccountEmail: "GCP_SERVICE_ACCOUNT_EMAIL",
} as const;

export type FederationState =
  | { kind: "off" }
  | { kind: "partial"; missing: string[] }
  | { kind: "ready"; config: Federation };

/** "off" when none of the four variables is set (a laptop using its own Google sign-in), "partial" when only some are. */
export function federationState(env: Record<string, string | undefined> = process.env): FederationState {
  const values = Object.fromEntries(Object.entries(NAMES).map(([key, name]) => [key, env[name]?.trim() ?? ""])) as Record<keyof typeof NAMES, string>;
  const missing = Object.entries(NAMES).filter(([key]) => !values[key as keyof typeof NAMES]).map(([, name]) => name);
  if (missing.length === Object.keys(NAMES).length) return { kind: "off" };
  if (missing.length > 0) return { kind: "partial", missing };
  return { kind: "ready", config: values };
}

/** The credential description Google's library expects, minus the part that fetches Vercel's token. */
export function externalAccount(c: Federation) {
  return {
    type: "external_account" as const,
    audience: `//iam.googleapis.com/projects/${c.projectNumber}/locations/global/workloadIdentityPools/${c.poolId}/providers/${c.providerId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${c.serviceAccountEmail}:generateAccessToken`,
  };
}
