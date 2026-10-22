import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnv } from "./env";

describe("adapter production guard", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("refuses DATA_ADAPTER=mock in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATA_ADAPTER", "mock");
    expect(() => getEnv()).toThrow(/not permitted in production/);
  });
  it("allows mock in development and synced in production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATA_ADAPTER", "mock");
    expect(getEnv().DATA_ADAPTER).toBe("mock");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATA_ADAPTER", "synced");
    expect(getEnv().DATA_ADAPTER).toBe("synced");
  });
});
