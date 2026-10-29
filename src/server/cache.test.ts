import { afterEach, describe, expect, it, vi } from "vitest";
import { cached, clearCache } from "./cache";

afterEach(() => { clearCache(); vi.useRealTimers(); });

describe("cached", () => {
  it("loads once and serves later calls from memory", async () => {
    const load = vi.fn(async () => 42);
    expect(await cached("a", 1000, load)).toBe(42);
    expect(await cached("a", 1000, load)).toBe(42);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shares one load between concurrent callers", async () => {
    const load = vi.fn(() => new Promise<string>((r) => setTimeout(() => r("x"), 10)));
    const [a, b] = await Promise.all([cached("b", 1000, load), cached("b", 1000, load)]);
    expect([a, b]).toEqual(["x", "x"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reloads after the entry expires", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => Date.now());
    await cached("c", 1000, load);
    vi.advanceTimersByTime(1001);
    await cached("c", 1000, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed load", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    await expect(cached("d", 1000, load)).rejects.toThrow("boom");
    expect(await cached("d", 1000, load)).toBe("ok");
  });

  it("clears by prefix", async () => {
    const load = vi.fn(async () => 1);
    await cached("snap:1", 1000, load);
    await cached("user:1", 1000, load);
    clearCache("snap:");
    await cached("snap:1", 1000, load);
    await cached("user:1", 1000, load);
    expect(load).toHaveBeenCalledTimes(3);
  });
});
