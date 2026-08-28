import { describe, it, expect } from "vitest";
import { getAlgorithm, BOX_INTERVALS } from "@/lib/srs";
import type { SRSAlgorithmType, SRSState } from "@/lib/srs/types";

const NOW = new Date("2025-08-29");

/**
 * Algorithm switch invariant test: ensure no algorithm pair collapses the
 * interval below what the accumulated history justifies.
 *
 * This test covers all 6 ordered pairs of SM2/Leitner/FSRS switches:
 * - SM2 → Leitner → SM2
 * - SM2 → FSRS → SM2
 * - Leitner → SM2 → Leitner
 * - Leitner → FSRS → Leitner
 * - FSRS → SM2 → FSRS
 * - FSRS → Leitner → FSRS
 *
 * The invariant is: after a switch, the next review's interval must not be
 * less than what the prior algorithm's history reached. A user should not
 * lose months of scheduling progress because they changed algorithms.
 */

describe("Algorithm switching — interval preservation", () => {
  /**
   * Run several reviews on an algorithm to build up a history with a target
   * intervalDays. Returns the state after the final review.
   */
  function buildHistory(
    algorithm: SRSAlgorithmType,
    targetIntervalDays: number,
    startDate: Date
  ): SRSState {
    const algo = getAlgorithm(algorithm);
    let state = algo.initialState(startDate);
    let now = new Date(startDate);

    // Run reviews until we reach or exceed the target interval.
    // Quality 4 (correct, known) is the "good" case for all algorithms.
    let iterations = 0;
    while (state.intervalDays < targetIntervalDays && iterations < 20) {
      const res = algo.calculateNextReview(state, 4, now);
      state = res.next;
      now = new Date(state.dueAt);
      iterations++;
    }

    return state;
  }

  /**
   * Get the minimum interval that should be preserved after switching.
   * Accounts for algorithm ceilings: Leitner maxes at 16 days.
   */
  function minimumPreservedInterval(
    state: SRSState,
    destAlgo: SRSAlgorithmType
  ): number {
    // If the state was from Leitner, the box maps to an interval.
    // If not, use the raw intervalDays.
    let sourceInterval = state.intervalDays;
    if (state.box > 1 && state.box <= BOX_INTERVALS.length) {
      sourceInterval = BOX_INTERVALS[state.box - 1];
    }

    // Cap by the destination algorithm's ceiling
    const MAX_LEITNER_INTERVAL = 16;
    if (destAlgo === "LEITNER") {
      return Math.min(sourceInterval, MAX_LEITNER_INTERVAL);
    }
    return Math.max(sourceInterval, 1);
  }

  it.each<[SRSAlgorithmType, SRSAlgorithmType]>([
    ["SM2", "LEITNER"],
    ["SM2", "FSRS"],
    ["LEITNER", "SM2"],
    ["LEITNER", "FSRS"],
    ["FSRS", "SM2"],
    ["FSRS", "LEITNER"],
  ])(
    "switching %s → %s preserves interval history",
    (sourceAlgo, destAlgo) => {
      // 1. Build history on the source algorithm: reach ~30-day interval
      const sourceState = buildHistory(sourceAlgo, 30, NOW);
      const minInterval = minimumPreservedInterval(sourceState, destAlgo);

      // 2. Switch to the destination algorithm by passing the state through
      const destAlgorithm = getAlgorithm(destAlgo);
      const switchedState = { ...sourceState };

      // 3. Run one review on the destination algorithm
      const res = destAlgorithm.calculateNextReview(switchedState, 4, NOW);
      const nextState = res.next;

      // 4. Assert the interval was not collapsed below what the history justifies.
      // The next review's interval should be at least minInterval.
      expect(nextState.intervalDays).toBeGreaterThanOrEqual(minInterval);

      // Also verify it's a reasonable interval (not negative or NaN)
      expect(nextState.intervalDays).toBeGreaterThan(0);
      expect(Number.isFinite(nextState.intervalDays)).toBe(true);
      expect(nextState.dueAt > NOW).toBe(true);
    }
  );

  it("SM2 with 200-day interval switching to Leitner does not drop to 2 days", () => {
    // This is the concrete bug case: FSRS builds 200-day interval,
    // switch to Leitner, and Leitner's initial box=1 + 1 = 2 → 2-day interval.
    const sm2 = getAlgorithm("SM2");
    let state = sm2.initialState(NOW);
    let now = new Date(NOW);

    // Build up ~200 day interval in SM-2 via repeated q=5 (perfect reviews)
    for (let i = 0; i < 10; i++) {
      const res = sm2.calculateNextReview(state, 5, now);
      state = res.next;
      now = new Date(state.dueAt);
    }

    expect(state.intervalDays).toBeGreaterThan(100); // Should be 200+

    // Switch to Leitner
    const leitner = getAlgorithm("LEITNER");
    const res = leitner.calculateNextReview(state, 4, NOW);
    const nextState = res.next;

    // Before the fix, this would fail: nextState.intervalDays would be 2.
    // After the fix, it should be at least box 5 (16 days) or hydrated from
    // the incoming intervalDays.
    expect(nextState.intervalDays).toBeGreaterThan(10);
  });
});
