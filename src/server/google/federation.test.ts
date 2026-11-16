import { describe, expect, it } from "vitest";
import { externalAccount, federationState } from "./federation";

const FULL = {
  GCP_PROJECT_NUMBER: "123456789",
  GCP_WORKLOAD_IDENTITY_POOL_ID: "vercel",
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "vercel-oidc",
  GCP_SERVICE_ACCOUNT_EMAIL: "biz-dash-sync@example-project.iam.gserviceaccount.com",
};

describe("federationState", () => {
  it("is off when nothing is set, so a laptop keeps using its own Google sign-in", () => {
    expect(federationState({})).toEqual({ kind: "off" });
    expect(federationState({ GCP_PROJECT_NUMBER: "  " })).toEqual({ kind: "off" });
  });

  it("names what is missing when only some variables are set", () => {
    const { GCP_SERVICE_ACCOUNT_EMAIL: _dropped, ...rest } = FULL;
    expect(federationState(rest)).toEqual({ kind: "partial", missing: ["GCP_SERVICE_ACCOUNT_EMAIL"] });
  });

  it("is ready with all four, trimmed", () => {
    const state = federationState({ ...FULL, GCP_WORKLOAD_IDENTITY_POOL_ID: " vercel " });
    expect(state).toEqual({ kind: "ready", config: { projectNumber: "123456789", poolId: "vercel", providerId: "vercel-oidc", serviceAccountEmail: FULL.GCP_SERVICE_ACCOUNT_EMAIL } });
  });
});

describe("externalAccount", () => {
  it("builds the audience and impersonation address Google expects", () => {
    const state = federationState(FULL);
    if (state.kind !== "ready") throw new Error("expected ready");
    const acc = externalAccount(state.config);
    expect(acc.audience).toBe("//iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/vercel/providers/vercel-oidc");
    expect(acc.service_account_impersonation_url).toBe("https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/biz-dash-sync@example-project.iam.gserviceaccount.com:generateAccessToken");
    expect(acc.token_url).toBe("https://sts.googleapis.com/v1/token");
  });
});
