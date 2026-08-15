import { describe, it, expect } from "vitest";
import { FAST_MS, SLOW_MS, qualityForOutcome, isValidQuality } from "@/lib/ninja/scoring";
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
});
