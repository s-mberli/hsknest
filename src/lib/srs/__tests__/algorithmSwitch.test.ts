import { describe, it, expect } from "vitest";
import { getAlgorithm, BOX_INTERVALS } from "@/lib/srs";
import type { SRSAlgorithmType, SRSState } from "@/lib/srs/types";

const NOW = new Date("2025-08-29");

/**
 * Algorithm-switch invariant: `recall-change-control` states that "a user can
 * switch preferredAlgorithm at any time and switch back with zero data loss",
 * and that no field may be algorithm-exclusive.
 *
 * Measured reality: **only FSRS honors that contract.**
 *
 *   destination | hydrates from a foreign state?
 *   ------------|--------------------------------------------------------
 *   FSRS        | yes — derives S from state.intervalDays (fsrs.ts:80-82)
 *   LEITNER     | NO  — reads state.box, which only Leitner ever writes
 *   SM2         | NO  — reads state.repetitions, which Leitner never writes
 *
 * So `box` and `repetitions` are effectively algorithm-exclusive, and switching
 * INTO Leitner or SM-2 collapses the schedule. The it.fails() cases below pin
 * that defect: they pass while the bug exists and break loudly the day someone
 * fixes it, which is the signal to flip them back to plain it().
 *
 * A fix was attempted and reverted — hydrating on `intervalDays > 0` also fires
 * on SM-2's own lapse recovery (a lapse sets repetitions=0, intervalDays=1),
 * handing a 2-3 day interval to a word the user just forgot. Any real fix must
 * discriminate on `state.state` ("LEARNING" = lapsed, "REVIEW" = switched)
 * rather than on the interval, and must account for modifiers.ts:40 rewriting
 * intervalDays after the algorithm runs.
 */

describe("Algorithm switching — interval preservation", () => {
  /** Review repeatedly at quality 4 until the interval reaches the target. */
  function buildHistory(
    algorithm: SRSAlgorithmType,
    targetIntervalDays: number,
    startDate: Date
  ): SRSState {
    const algo = getAlgorithm(algorithm);
    let state = algo.initialState(startDate);
    let now = new Date(startDate);

    let iterations = 0;
    while (state.intervalDays < targetIntervalDays && iterations < 20) {
      state = algo.calculateNextReview(state, 4, now).next;
      now = new Date(state.dueAt);
      iterations++;
    }
    return state;
  }

  /** What the accumulated history justifies, capped by the destination's ceiling. */
  function minimumPreservedInterval(
    state: SRSState,
    destAlgo: SRSAlgorithmType
  ): number {
    let sourceInterval = state.intervalDays;
    if (state.box > 1 && state.box <= BOX_INTERVALS.length) {
      sourceInterval = BOX_INTERVALS[state.box - 1];
    }
    // Leitner's own ceiling is box 5 = 16 days; it cannot honor more than that.
    const MAX_LEITNER_INTERVAL = BOX_INTERVALS[BOX_INTERVALS.length - 1];
    if (destAlgo === "LEITNER") {
      return Math.min(sourceInterval, MAX_LEITNER_INTERVAL);
    }
    return Math.max(sourceInterval, 1);
  }

  function assertSwitchPreservesInterval(
    sourceAlgo: SRSAlgorithmType,
    destAlgo: SRSAlgorithmType
  ) {
    const sourceState = buildHistory(sourceAlgo, 30, NOW);
    const minInterval = minimumPreservedInterval(sourceState, destAlgo);

    const { next } = getAlgorithm(destAlgo).calculateNextReview(
      { ...sourceState },
      4,
      NOW
    );

    expect(next.intervalDays).toBeGreaterThanOrEqual(minInterval);
    expect(next.intervalDays).toBeGreaterThan(0);
    expect(Number.isFinite(next.intervalDays)).toBe(true);
    expect(next.dueAt > NOW).toBe(true);
  }

  describe("switching INTO FSRS — hydrates correctly", () => {
    it.each<[SRSAlgorithmType, SRSAlgorithmType]>([
      ["SM2", "FSRS"],
      ["LEITNER", "FSRS"],
      ["FSRS", "SM2"],
    ])("switching %s → %s preserves interval history", (from, to) => {
      assertSwitchPreservesInterval(from, to);
    });
  });

  describe("switching INTO Leitner or SM-2 — KNOWN BUG, schedule collapses", () => {
    // Leitner reads state.box; SM-2 and FSRS never write it, so a switched-in
    // card is treated as box 1 and promoted to box 2 → a 2-day interval.
    it.fails("switching SM2 → LEITNER preserves interval history", () => {
      assertSwitchPreservesInterval("SM2", "LEITNER");
    });

    it.fails("switching FSRS → LEITNER preserves interval history", () => {
      assertSwitchPreservesInterval("FSRS", "LEITNER");
    });

    // SM-2 reads state.repetitions; leitner.ts never writes it, so a card with
    // months of Leitner history is treated as brand new → a 1-day interval.
    it.fails("switching LEITNER → SM2 preserves interval history", () => {
      assertSwitchPreservesInterval("LEITNER", "SM2");
    });

    // The headline case: eight months of study, thrown away by one setting change.
    it.fails(
      "SM2 with a 200-day interval switching to Leitner does not drop to 2 days",
      () => {
        const sm2 = getAlgorithm("SM2");
        let state = sm2.initialState(NOW);
        let now = new Date(NOW);

        for (let i = 0; i < 10; i++) {
          state = sm2.calculateNextReview(state, 5, now).next;
          now = new Date(state.dueAt);
        }
        expect(state.intervalDays).toBeGreaterThan(100);

        const { next } = getAlgorithm("LEITNER").calculateNextReview(state, 4, NOW);
        expect(next.intervalDays).toBeGreaterThan(10);
      }
    );
  });
});
