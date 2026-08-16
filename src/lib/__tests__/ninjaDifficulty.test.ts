import { describe, it, expect } from "vitest";
import {
  initialDifficultyState,
  nextDifficulty,
  paramsForLevel,
  WINDOW,
} from "@/lib/ninja/difficulty";

describe("ninjaDifficulty", () => {
  describe("nextDifficulty", () => {
    it("stays inert until MIN_HISTORY outcomes are recorded", () => {
      let state = initialDifficultyState();
      state = nextDifficulty(state, false);
      expect(state.level).toBe(0);
      state = nextDifficulty(state, false);
      expect(state.level).toBe(0); // still below MIN_HISTORY (3)
    });

    it("raises level once accuracy is consistently above target (0.85)", () => {
      let state = initialDifficultyState();
      for (let i = 0; i < WINDOW; i++) {
        state = nextDifficulty(state, true);
      }
      expect(state.level).toBeGreaterThan(0);
    });

    it("lowers level when accuracy is consistently below target", () => {
      let state = initialDifficultyState();
      // Get it up first
      for (let i = 0; i < WINDOW; i++) state = nextDifficulty(state, true);
      const raised = state.level;
      expect(raised).toBeGreaterThan(0);

      // Then a bad streak should pull it back down
      for (let i = 0; i < WINDOW; i++) state = nextDifficulty(state, false);
      expect(state.level).toBeLessThan(raised);
    });

    it("clamps level to [0, 1]", () => {
      let state = initialDifficultyState();
      for (let i = 0; i < 200; i++) state = nextDifficulty(state, true);
      expect(state.level).toBeLessThanOrEqual(1);

      for (let i = 0; i < 200; i++) state = nextDifficulty(state, false);
      expect(state.level).toBeGreaterThanOrEqual(0);
    });

    it("keeps the rolling history capped at WINDOW", () => {
      let state = initialDifficultyState();
      for (let i = 0; i < WINDOW + 10; i++) state = nextDifficulty(state, true);
      expect(state.history.length).toBe(WINDOW);
    });

    it("is pure — does not mutate the input state", () => {
      const state = initialDifficultyState();
      const historyRef = state.history;
      nextDifficulty(state, true);
      expect(state.history).toBe(historyRef);
      expect(state.level).toBe(0);
    });
  });

  describe("paramsForLevel", () => {
    it("returns the loosest params at level 0", () => {
      const params = paramsForLevel(0);
      expect(params.leadInMs).toBe(700); // prompt-first beat
      expect(params.distractorCloseness).toBe(0);
    });

    it("returns tightest distractorCloseness at level 1, fixed leadInMs", () => {
      const params = paramsForLevel(1);
      expect(params.leadInMs).toBe(700); // prompt-first beat, fixed
      expect(params.distractorCloseness).toBe(1);
    });

    it("interpolates distractorCloseness linearly at intermediate levels, fixed leadInMs", () => {
      const params = paramsForLevel(0.5);
      expect(params.leadInMs).toBe(700); // prompt-first beat, fixed
      expect(params.distractorCloseness).toBeCloseTo(0.5, 5);
    });
  });
});
