import { describe, expect, it } from "vitest";
import { filterScope } from "./filter-scope";

describe("filterScope", () => {
  it("gives the portfolio-style pages every filter", () => {
    for (const p of ["/portfolio", "/clients", "/csm"]) expect(filterScope(p), p).toEqual({ client: true, industry: true, period: true });
  });
  it("gives a client profile and Compare only the period", () => {
    for (const p of ["/clients/384", "/clients/384/anything", "/clients/compare"]) expect(filterScope(p), p).toEqual({ client: false, industry: false, period: true });
  });
  it("hides the bar where nothing is filtered", () => {
    for (const p of ["/settings", "/data-reliability", "/how-it-works", "/metrics"]) expect(filterScope(p), p).toEqual({ client: false, industry: false, period: false });
  });
  it("keeps every filter for a page it does not know", () => expect(filterScope("/something-new")).toEqual({ client: true, industry: true, period: true }));
});
