import { describe, expect, it } from "vitest";
import { can, seedRole } from "./rbac";

const admins = ["boss@bizgroup.ae"];

describe("seedRole", () => {
  it("makes listed admins ADMIN and other confirmed company emails MEMBER", () => {
    expect(seedRole("boss@bizgroup.ae", admins, true)).toBe("ADMIN");
    expect(seedRole("Boss@BizGroup.ae", admins, true)).toBe("ADMIN");
    expect(seedRole("analyst@bizgroup.ae", admins, true)).toBe("MEMBER");
  });

  it("gives everyone else an unlinked CLIENT role", () => {
    expect(seedRole("someone@customer.com", admins, true)).toBe("CLIENT");
    expect(seedRole("someone@bizgroup.ae.evil.com", admins, true)).toBe("CLIENT");
    expect(seedRole("a@notbizgroup.ae", admins, true)).toBe("CLIENT");
  });

  it("does not trust an unconfirmed email, even a company or admin one", () => {
    expect(seedRole("boss@bizgroup.ae", admins, false)).toBe("CLIENT");
    expect(seedRole("analyst@bizgroup.ae", admins, false)).toBe("CLIENT");
  });

  it("leaves a new external user with only the QBR permission", () => {
    expect(can("CLIENT", "dashboard:read")).toBe(true);
    expect(can("CLIENT", "portfolio:read")).toBe(false);
    expect(can("CLIENT", "settings:manage")).toBe(false);
  });
});
