import { describe, expect, it } from "vitest";
import { DEFAULT_MASTERY_THRESHOLD_DAYS, mastery, streak } from "./wordStats";

describe("mastery", () => {
  it("scales interval against the threshold, clamped to [0, 100]", () => {
    expect(mastery({ intervalDays: 30 }, 60)).toBe(50);
    expect(mastery({ intervalDays: 60 }, 60)).toBe(100);
    expect(mastery({ intervalDays: 120 }, 60)).toBe(100);
    expect(mastery({ intervalDays: 0 }, 60)).toBe(0);
  });

  it("falls back to the default threshold when unset/null/<=0", () => {
    expect(mastery({ intervalDays: DEFAULT_MASTERY_THRESHOLD_DAYS }, null)).toBe(
      100
    );
    expect(
      mastery({ intervalDays: DEFAULT_MASTERY_THRESHOLD_DAYS }, undefined)
    ).toBe(100);
    expect(mastery({ intervalDays: DEFAULT_MASTERY_THRESHOLD_DAYS }, 0)).toBe(
      100
    );
  });

  it("handles missing or invalid intervalDays gracefully", () => {
    expect(mastery({ intervalDays: null }, 60)).toBe(0);
    expect(mastery({ intervalDays: -5 }, 60)).toBe(0);
  });
});

describe("streak", () => {
  it("passes through repetitions", () => {
    expect(streak({ repetitions: 4 })).toBe(4);
    expect(streak({ repetitions: 0 })).toBe(0);
  });

  it("is null-safe", () => {
    expect(streak({ repetitions: null })).toBe(0);
  });
});
