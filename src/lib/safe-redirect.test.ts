import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./safe-redirect";

describe("safeCallbackUrl", () => {
  it("keeps same-site paths", () => {
    expect(safeCallbackUrl("/clients")).toBe("/clients");
    expect(safeCallbackUrl("/qbr?client=324&from=2026-01")).toBe("/qbr?client=324&from=2026-01");
    expect(safeCallbackUrl("/")).toBe("/");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "evil", ""]) {
      expect(safeCallbackUrl(bad)).toBe("/portfolio");
    }
    expect(safeCallbackUrl(undefined)).toBe("/portfolio");
    expect(safeCallbackUrl(null, "/qbr")).toBe("/qbr");
  });
});
