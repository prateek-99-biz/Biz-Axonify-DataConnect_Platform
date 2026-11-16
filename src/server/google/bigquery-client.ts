import type { BigQuery } from "@google-cloud/bigquery";
import { externalAccount, federationState } from "./federation";

/**
 * The one place a BigQuery client is made.
 *
 * With the four GCP_ variables set (the hosted site) it signs in through Workload Identity Federation: no key file and
 * no person. Without them it uses the Google sign-in stored on the machine (`gcloud auth application-default login`),
 * which is how the laptop scripts work. A half-filled set is an error, so a typo cannot quietly fall back to the wrong
 * identity.
 */
export async function bigQueryClient(projectId: string | undefined): Promise<BigQuery> {
  const { BigQuery } = await import("@google-cloud/bigquery");
  const state = federationState();
  if (state.kind === "off") return new BigQuery({ projectId });
  if (state.kind === "partial") throw new Error(`Google sign-in for the hosted site is half configured. Missing: ${state.missing.join(", ")}.`);

  const [{ ExternalAccountClient }, { getVercelOidcToken }] = await Promise.all([import("google-auth-library"), import("@vercel/oidc")]);
  const authClient = ExternalAccountClient.fromJSON({ ...externalAccount(state.config), subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() } });
  if (!authClient) throw new Error("Google sign-in for the hosted site could not be set up from the GCP_ variables.");
  return new BigQuery({ projectId, authClient });
}
