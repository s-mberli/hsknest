import {
  addDays,
  type ReviewQuality,
  type SRSAlgorithm,
  type SRSResult,
  type SRSState,
} from "./types";

/** Interval in days for each of the 5 boxes (box 1 → index 0). */
const BOX_INTERVALS = [1, 2, 4, 8, 16] as const;
const MAX_BOX = BOX_INTERVALS.length; // 5

/**
 * Leitner box system with 5 boxes.
 * Correct answer promotes one box (capped at 5); wrong answer resets to box 1.
 * easeFactor / repetitions are carried through untouched for algorithm-switch safety.
 */
export class LeitnerSystem implements SRSAlgorithm {
  readonly id = "LEITNER" as const;

  initialState(now: Date): SRSState {
    return {
      state: "NEW",
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      box: 1,
      lapses: 0,
      dueAt: new Date(now.getTime()),
      lastReviewedAt: null,
    };
  }

  calculateNextReview(
    state: SRSState,
    quality: ReviewQuality,
    now: Date
  ): SRSResult {
    let box: number;
    let lapses = state.lapses;
    let cardState: SRSState["state"];

    if (quality >= 3) {
      box = Math.min(state.box + 1, MAX_BOX);
      cardState = "REVIEW";
    } else {
      box = 1;
      lapses = state.lapses + 1;
      cardState = "LEARNING";
    }

    const intervalDays = BOX_INTERVALS[box - 1];

    const next: SRSState = {
      ...state,
      state: cardState,
      box,
      lapses,
      intervalDays,
      dueAt: addDays(now, intervalDays),
      lastReviewedAt: new Date(now.getTime()),
    };

    return { next };
  }
}

export { BOX_INTERVALS };
