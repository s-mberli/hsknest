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
    // Hydrate box from intervalDays when switching from another algorithm.
    // This ensures that a user who studied on FSRS for 200 days and switches
    // to Leitner doesn't collapse back to a 1–2 day interval.
    // Pattern mirrors fsrs.ts:80-82 (hydrate S from intervalDays).
    let currentBox = state.box;
    if (currentBox === 1 && state.intervalDays > 0) {
      // Derive the highest box whose interval ≤ incoming intervalDays
      for (let b = MAX_BOX; b >= 1; b--) {
        if (BOX_INTERVALS[b - 1] <= state.intervalDays) {
          currentBox = b;
          break;
        }
      }
    }

    let box: number;
    let lapses = state.lapses;
    let cardState: SRSState["state"];

    if (quality >= 3) {
      box = Math.min(currentBox + 1, MAX_BOX);
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
