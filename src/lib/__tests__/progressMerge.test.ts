import { describe, expect, it } from "vitest";

import { pickStrongestProgress, termKey } from "@/lib/progressMerge";

describe("termKey", () => {
  it("trims and NFC-normalizes", () => {
    expect(termKey("  你好 ")).toBe("你好");
    // é composed vs decomposed
    expect(termKey("café")).toBe(termKey("café"));
  });
});

describe("pickStrongestProgress", () => {
  const base = { intervalDays: 0, repetitions: 0, lastReviewedAt: null };

  it("prefers the longest interval", () => {
    const weak = { ...base, id: "a", intervalDays: 2 };
    const strong = { ...base, id: "b", intervalDays: 10 };
    expect(pickStrongestProgress([weak, strong]).id).toBe("b");
    expect(pickStrongestProgress([strong, weak]).id).toBe("b");
  });

  it("breaks interval ties by repetitions", () => {
    const a = { ...base, id: "a", intervalDays: 5, repetitions: 1 };
    const b = { ...base, id: "b", intervalDays: 5, repetitions: 4 };
    expect(pickStrongestProgress([a, b]).id).toBe("b");
  });

  it("breaks full ties by most recent review", () => {
    const a = { ...base, id: "a", lastReviewedAt: new Date("2026-01-01") };
    const b = { ...base, id: "b", lastReviewedAt: new Date("2026-06-01") };
    expect(pickStrongestProgress([a, b]).id).toBe("b");
  });

  it("returns the single row unchanged", () => {
    const only = { ...base, id: "x" };
    expect(pickStrongestProgress([only]).id).toBe("x");
  });
});
