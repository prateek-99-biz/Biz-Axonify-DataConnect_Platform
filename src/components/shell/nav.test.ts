import { describe, expect, it } from "vitest";
import { activeHref, breadcrumbs, NAV, NAV_GROUPS, SHELL_PERMISSIONS } from "./nav";
import { can } from "@/server/auth/rbac";
import { titleCase } from "@/lib/labels";

const visibleTo = (role: "ADMIN" | "MEMBER" | "CLIENT") => NAV.filter((n) => SHELL_PERMISSIONS.filter((p) => can(role, p)).includes(n.perm)).map((n) => n.href);

describe("menu", () => {
  it("checks every permission a menu item needs, so no page is silently left out", () => {
    for (const n of NAV) expect(SHELL_PERMISSIONS, n.href).toContain(n.perm);
  });

  it("shows staff every Insights page, Cost to Serve included", () => {
    for (const role of ["ADMIN", "MEMBER"] as const) {
      const hrefs = visibleTo(role);
      for (const p of ["/insights/leaderboard", "/insights/health", "/insights/benchmarks", "/insights/ai", "/insights/csm", "/insights/cost"]) expect(hrefs, `${role} ${p}`).toContain(p);
    }
  });

  it("keeps Settings for admins and every internal page away from client users", () => {
    expect(visibleTo("MEMBER")).not.toContain("/settings");
    expect(visibleTo("ADMIN")).toContain("/settings");
    expect(visibleTo("CLIENT").filter((h) => h.startsWith("/insights") || ["/internal", "/csm", "/alerts", "/renewals", "/portfolio"].includes(h))).toEqual([]);
  });

  it("puts every item in a known group, with a Title Case label", () => {
    for (const n of NAV) {
      expect(NAV_GROUPS, n.href).toContain(n.group);
      expect(titleCase(n.label), n.href).toBe(n.label);
    }
  });

  it("marks the deepest matching item as active", () => {
    expect(activeHref("/insights/csm")).toBe("/insights/csm");
    expect(activeHref("/csm")).toBe("/csm");
    expect(activeHref("/clients/compare")).toBe("/clients/compare");
    expect(activeHref("/clients/123")).toBe("/clients");
  });
});

describe("breadcrumbs", () => {
  it("use the menu label for the full path", () => {
    expect(breadcrumbs("/insights/csm")).toEqual([{ href: "/insights", label: "Insights" }, { href: "/insights/csm", label: "CSM Portfolio" }]);
    expect(breadcrumbs("/insights/cost").at(-1)?.label).toBe("Cost to Serve");
    expect(breadcrumbs("/csm")).toEqual([{ href: "/csm", label: "My Accounts" }]);
  });

  it("keep the existing pages as they were", () => {
    expect(breadcrumbs("/clients/compare").map((c) => c.label)).toEqual(["Clients", "Compare Clients"]);
    expect(breadcrumbs("/clients/384").map((c) => c.label)).toEqual(["Clients", "Client 360"]);
    expect(breadcrumbs("/data-reliability").map((c) => c.label)).toEqual(["Data Reliability"]);
    expect(breadcrumbs("/")).toEqual([]);
  });
});
