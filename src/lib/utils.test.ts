import { describe, expect, it } from "vitest";
import { fmtAxisPct, fmtCompact, fmtHealth, fmtNumber, fmtPct } from "./utils";

describe("fmtPct", () => {
  it("writes ordinary shares as before", () => {
    expect(fmtPct(0.321)).toBe("32.1%");
    expect(fmtPct(1)).toBe("100.0%");
    expect(fmtPct(0.5, 0)).toBe("50%");
    expect(fmtPct(0.0005)).toBe("0.1%");
  });

  it("never shows a share that is not zero as zero", () => {
    expect(fmtPct(0.0003)).toBe("<0.1%");
    expect(fmtPct(2 / 7000)).toBe("<0.1%");
    expect(fmtPct(0.003, 0)).toBe("<1%");
  });

  it("keeps zero, negatives and missing values honest", () => {
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtPct(-0.05)).toBe("-5.0%");
    expect(fmtPct(null)).toBe("—");
    expect(fmtPct(undefined)).toBe("—");
    expect(fmtPct(Number.NaN)).toBe("—");
  });
});

describe("other formatters", () => {
  it("are unchanged", () => {
    expect(fmtNumber(1234.5)).toBe("1,235");
    expect(fmtNumber(1234.56, 1)).toBe("1,234.6");
    expect(fmtNumber(null)).toBe("—");
    expect(fmtCompact(38690)).toBe("38.7K");
    expect(fmtHealth(44.7)).toBe("44");
    expect(fmtHealth(null)).toBe("—");
  });
});

describe("fmtAxisPct", () => {
  it("keeps the whole-number axis labels the existing charts use", () => {
    expect([0, 0.25, 0.5, 0.75, 1].map(fmtAxisPct)).toEqual(["0%", "25%", "50%", "75%", "100%"]);
    expect(fmtAxisPct(0.821)).toBe("82%");
  });

  it("keeps small ticks distinct and exact", () => {
    expect([0.0025, 0.005, 0.0075, 0.01].map(fmtAxisPct)).toEqual(["0.25%", "0.50%", "0.75%", "1.0%"]);
    expect(fmtAxisPct(0.05)).toBe("5.0%");
  });
});
