import { describe, it, expect } from "vitest";
import { FAST_MS, qualityForOutcome, isValidQuality, pointsForSlice } from "@/lib/ninja/scoring";
import type { WaveOutcome } from "@/lib/ninja/types";

describe("ninjaScoring", () => {
  describe("qualityForOutcome", () => {
    it("returns 5 for target sliced within FAST_MS", () => {
      const outcome: WaveOutcome = {
        wordId: "word1",
        slicedTarget: true,
        slicedDistractor: false,
        missed: false,
        msToSlice: 500,
        quality: 5,
      };

      expect(qualityForOutcome(outcome)).toBe(5);
    });

    it("returns 4 for target sliced between FAST_MS and SLOW_MS", () => {
      const outcome: WaveOutcome = {
        wordId: "word1",
        slicedTarget: true,
        slicedDistractor: false,
        missed: false,
        msToSlice: 2000,
        quality: 4,
      };

      expect(qualityForOutcome(outcome)).toBe(4);
    });

    it("returns 3 for target sliced slower than SLOW_MS", () => {
      const outcome: WaveOutcome = {
        wordId: "word1",
        slicedTarget: true,
        slicedDistractor: false,
        missed: false,
        msToSlice: 3500,
        quality: 3,
      };

      expect(qualityForOutcome(outcome)).toBe(3);
    });

    it("returns 1 for distractor sliced", () => {
      const outcome: WaveOutcome = {
        wordId: "word1",
        slicedTarget: false,
        slicedDistractor: true,
        missed: false,
        msToSlice: 1000,
        quality: 1,
      };

      expect(qualityForOutcome(outcome)).toBe(1);
    });

    it("returns 1 for target missed", () => {
      const outcome: WaveOutcome = {
        wordId: "word1",
        slicedTarget: false,
        slicedDistractor: false,
        missed: true,
        msToSlice: null,
        quality: 1,
      };

      expect(qualityForOutcome(outcome)).toBe(1);
    });

    it("returns 3 (fallback) if target sliced but msToSlice is null", () => {
      const outcome: WaveOutcome = {
        wordId: "word1",
        slicedTarget: true,
        slicedDistractor: false,
        missed: false,
        msToSlice: null,
        quality: 3,
      };

      expect(qualityForOutcome(outcome)).toBe(3);
    });

    it("respects exact FAST_MS boundary", () => {
      const fast: WaveOutcome = {
        wordId: "word1",
        slicedTarget: true,
        slicedDistractor: false,
        missed: false,
        msToSlice: FAST_MS - 1,
        quality: 5,
      };
      expect(qualityForOutcome(fast)).toBe(5);

      const slow: WaveOutcome = {
        wordId: "word1",
        slicedTarget: true,
        slicedDistractor: false,
        missed: false,
        msToSlice: FAST_MS,
        quality: 4,
      };
      expect(qualityForOutcome(slow)).toBe(4);
    });
  });

  describe("isValidQuality", () => {
    it("accepts 1, 3, 4, 5", () => {
      expect(isValidQuality(1)).toBe(true);
      expect(isValidQuality(3)).toBe(true);
      expect(isValidQuality(4)).toBe(true);
      expect(isValidQuality(5)).toBe(true);
    });

    it("rejects 0, 2, 6, etc.", () => {
      expect(isValidQuality(0)).toBe(false);
      expect(isValidQuality(2)).toBe(false);
      expect(isValidQuality(6)).toBe(false);
    });

    it("rejects non-numbers", () => {
      expect(isValidQuality("5")).toBe(false);
      expect(isValidQuality(null)).toBe(false);
      expect(isValidQuality(undefined)).toBe(false);
    });
  });

  describe("pointsForSlice", () => {
    it("scores higher quality tiers higher at the same combo", () => {
      const p5 = pointsForSlice(5, 1);
      const p4 = pointsForSlice(4, 1);
      const p3 = pointsForSlice(3, 1);
      expect(p5).toBeGreaterThan(p4);
      expect(p4).toBeGreaterThan(p3);
    });

    it("scores 0 for a miss/wrong (quality 1)", () => {
      expect(pointsForSlice(1, 1)).toBe(0);
    });

    it("increases with combo, capped at 1.9x base (min(combo-1, 9) steps of +10%)", () => {
      const base = pointsForSlice(5, 1);
      const atCombo5 = pointsForSlice(5, 5);
      const atCombo50 = pointsForSlice(5, 50);
      expect(atCombo5).toBeGreaterThan(base);
      expect(atCombo50).toBe(Math.round(base * 1.9)); // multiplier caps at combo-1=9 steps
      expect(pointsForSlice(5, 11)).toBe(atCombo50); // same cap beyond 10
    });
  });

});
