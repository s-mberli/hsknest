import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _resetRateLimits, rateLimit, sweepRateLimits } from "@/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetRateLimits();
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetRateLimits();
  });

  it("allows calls up to the limit", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", 3, 1000)).toBe(true);
    }
  });

  it("blocks the call that exceeds the limit", () => {
    rateLimit("k", 3, 1000);
    rateLimit("k", 3, 1000);
    rateLimit("k", 3, 1000);
    expect(rateLimit("k", 3, 1000)).toBe(false);
  });

  it("resets once the window elapses", () => {
    expect(rateLimit("k", 1, 1000)).toBe(true);
    expect(rateLimit("k", 1, 1000)).toBe(false);

    vi.advanceTimersByTime(1000); // window boundary reached
    expect(rateLimit("k", 1, 1000)).toBe(true);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("a", 1, 1000)).toBe(true);
    expect(rateLimit("a", 1, 1000)).toBe(false);
    // A different key has its own fresh window.
    expect(rateLimit("b", 1, 1000)).toBe(true);
  });

  it("sweeps expired windows without affecting live ones", () => {
    rateLimit("expired", 5, 1000);
    vi.advanceTimersByTime(1500);
    rateLimit("live", 5, 1000);

    sweepRateLimits();

    // The expired key's counter was dropped, so it starts fresh at full quota.
    expect(rateLimit("expired", 1, 1000)).toBe(true);
    // The live key still counts against its existing window.
    expect(rateLimit("live", 1, 1000)).toBe(false);
  });
});
