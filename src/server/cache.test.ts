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

describe("cached with staleMs", () => {
  it("serves the old value at once after the TTL and refreshes in the background", async () => {
    vi.useFakeTimers();
    let n = 0;
    const load = vi.fn(async () => ++n);
    expect(await cached("s", 1000, load, 10_000)).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(await cached("s", 1000, load, 10_000)).toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(2);
    expect(await cached("s", 1000, load, 10_000)).toBe(2);
  });

  it("starts only one background refresh for concurrent callers", async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => new Promise<number>((r) => setTimeout(() => r(Date.now()), 50)));
    const first = cached("t", 1000, load, 10_000);
    await vi.advanceTimersByTimeAsync(50);
    await first;
    vi.advanceTimersByTime(1500);
    const [a, b] = await Promise.all([cached("t", 1000, load, 10_000), cached("t", 1000, load, 10_000)]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("makes callers wait for fresh data once the entry is older than staleMs", async () => {
    vi.useFakeTimers();
    let n = 0;
    const load = vi.fn(async () => ++n);
    await cached("u", 1000, load, 5000);
    vi.advanceTimersByTime(6000);
    expect(await cached("u", 1000, load, 5000)).toBe(2);
  });

  it("keeps the old copy when a background refresh fails", async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockResolvedValueOnce("old").mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce("new");
    expect(await cached("v", 1000, load, 10_000)).toBe("old");
    vi.advanceTimersByTime(1500);
    expect(await cached("v", 1000, load, 10_000)).toBe("old");
    await vi.advanceTimersByTimeAsync(0);
    expect(await cached("v", 1000, load, 10_000)).toBe("old");
    await vi.advanceTimersByTimeAsync(0);
    expect(await cached("v", 1000, load, 10_000)).toBe("new");
  });
});

describe("clearCache during a load", () => {
  it("does not keep a result that was loaded before the clear", async () => {
    let release!: (v: string) => void;
    const slow = vi.fn(() => new Promise<string>((r) => { release = r; }));
    const first = cached("w", 1000, slow);
    clearCache("w");
    release("before-sync");
    expect(await first).toBe("before-sync");
    const fresh = vi.fn(async () => "after-sync");
    expect(await cached("w", 1000, fresh)).toBe("after-sync");
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});
