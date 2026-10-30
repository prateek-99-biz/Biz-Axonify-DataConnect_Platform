import { describe, expect, it } from "vitest";
import { emailProblem, knownProblem, normalizeEmail, passwordProblem } from "./account-input";

describe("emailProblem", () => {
  it("accepts ordinary addresses", () => {
    expect(emailProblem("a.b@bizgroup.ae")).toBeNull();
    expect(emailProblem("x+tag@client.co.uk")).toBeNull();
  });
  it("rejects the rest", () => {
    for (const bad of ["", "no-at", "a@b", "a b@c.com", "@c.com", "a@.com"]) expect(emailProblem(bad), bad).not.toBeNull();
  });
  it("trims and lower-cases", () => expect(normalizeEmail("  A@B.com ")).toBe("a@b.com"));
});

describe("knownProblem", () => {
  it("passes our own messages through and drops anything else", () => {
    expect(knownProblem(passwordProblem("short1", "short1"))).toMatch(/at least/);
    expect(knownProblem("Your account is locked, call 555-0100")).toBeNull();
    expect(knownProblem(undefined)).toBeNull();
  });
});

describe("passwordProblem", () => {
  it("accepts a long enough mix of letters and numbers that matches", () => expect(passwordProblem("abcdefgh12", "abcdefgh12")).toBeNull());
  it("rejects short, letters-only, numbers-only and mismatched", () => {
    expect(passwordProblem("abc12", "abc12")).toMatch(/at least/);
    expect(passwordProblem("abcdefghijk", "abcdefghijk")).toMatch(/letters and numbers/);
    expect(passwordProblem("1234567890", "1234567890")).toMatch(/letters and numbers/);
    expect(passwordProblem("abcdefgh12", "abcdefgh13")).toMatch(/match/);
  });
});
