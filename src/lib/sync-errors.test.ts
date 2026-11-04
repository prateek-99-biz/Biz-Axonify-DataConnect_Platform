import { describe, expect, it } from "vitest";
import { explainSyncFailure } from "./sync-errors";

describe("explainSyncFailure", () => {
  it("recognises an expired or missing Google sign-in, in both of the forms it has appeared", () => {
    const missing = 'BigQuery query "clientPeriod" failed: Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.';
    const expired = 'BigQuery query "clientPeriod" failed: {"error":"invalid_grant","error_description":"reauth related error (invalid_rapt)","error_uri":"https://support.google.com/a/answer/9368756","error_subtype":"invalid_rapt"}';
    for (const m of [missing, expired]) expect(explainSyncFailure(m)?.summary, m).toBe("Google sign-in has expired.");
    expect(explainSyncFailure(expired)?.fix).toMatch(/gcloud auth application-default login/);
  });

  it("recognises access and connection problems", () => {
    expect(explainSyncFailure("Access Denied: Project x: User does not have bigquery.jobs.create permission")?.summary).toMatch(/denied access/);
    expect(explainSyncFailure("connect ETIMEDOUT 142.250.0.1:443")?.summary).toMatch(/timed out/);
  });

  it("leaves an unknown error alone so it is shown as received", () => {
    expect(explainSyncFailure("Something nobody has seen before")).toBeNull();
  });
});
