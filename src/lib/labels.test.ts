import { describe, expect, it } from "vitest";
import { humanize, riskLabel, statusLabel, titleCase } from "./labels";

describe("titleCase", () => {
  it("capitalises headings and keeps small words in lower case", () => {
    expect(titleCase("knowledge growth by topic")).toBe("Knowledge Growth by Topic");
    expect(titleCase("what changed")).toBe("What Changed");
    expect(titleCase("contract & renewals")).toBe("Contract & Renewals");
    expect(titleCase("at risk / critical")).toBe("At Risk / Critical");
  });

  it("always capitalises the first and last word", () => {
    expect(titleCase("the matrix of")).toBe("The Matrix Of");
  });

  it("capitalises each part of a hyphenated word", () => {
    expect(titleCase("follow-up tasks")).toBe("Follow-Up Tasks");
    expect(titleCase("non-participants")).toBe("Non-Participants");
  });

  it("writes known acronyms in capitals", () => {
    expect(titleCase("csm books of business")).toBe("CSM Books of Business");
    expect(titleCase("crm mapping")).toBe("CRM Mapping");
    expect(titleCase("what it means")).toBe("What It Means");
    expect(titleCase("last loaded (utc)")).toBe("Last Loaded (UTC)");
  });

  it("is stable when applied twice", () => {
    expect(titleCase(titleCase("training participation and average frequency by month"))).toBe("Training Participation and Average Frequency by Month");
  });
});

describe("humanize", () => {
  it("turns stored keys into words", () => {
    expect(humanize("at_risk")).toBe("At Risk");
    expect(humanize("atRisk")).toBe("At Risk");
    expect(humanize("training_users")).toBe("Training Users");
    expect(humanize("in_progress")).toBe("In Progress");
  });
});

describe("statusLabel", () => {
  it("uses written labels for known statuses and falls back to the key in words", () => {
    expect(statusLabel("ok")).toBe("Succeeded");
    expect(statusLabel("failed")).toBe("Failed");
    expect(statusLabel("approved")).toBe("Approved");
    expect(statusLabel("needs_review")).toBe("Needs Review");
  });
});

describe("riskLabel", () => {
  it("writes health bands in words", () => {
    expect(riskLabel("at_risk")).toBe("At Risk");
    expect(riskLabel("unknown")).toBe("No Data");
    expect(riskLabel("healthy")).toBe("Healthy");
  });
});
