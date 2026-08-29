import {
  addDays,
  type ReviewQuality,
  type SRSAlgorithm,
  type SRSResult,
  type SRSState,
} from "./types";

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const MAX_INTERVAL_DAYS = 10950; // 30 years

/**
 * SM-2 (SuperMemo 2) spaced-repetition algorithm.
 * Pure — never mutates the input state.
 */
export class SM2Algorithm implements SRSAlgorithm {
  readonly id = "SM2" as const;

  initialState(now: Date): SRSState {
    return {
      state: "NEW",
      easeFactor: DEFAULT_EASE_FACTOR,
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
    // EF update (always applied, per SM-2), clamped to a floor of 1.3.
    const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    const easeFactor = Math.max(MIN_EASE_FACTOR, state.easeFactor + efDelta);

    let repetitions: number;
    let intervalDays: number;
    let lapses = state.lapses;
    let cardState: SRSState["state"];

    if (quality < 3) {
      // Failed recall — reset progress, schedule again soon.
      repetitions = 0;
      intervalDays = 1;
      lapses = state.lapses + 1;
      cardState = "LEARNING";
    } else {
      // Successful recall.
      if (state.repetitions === 0) {
        intervalDays = 1;
      } else if (state.repetitions === 1) {
        intervalDays = 6;
      } else {
        intervalDays = Math.round(state.intervalDays * easeFactor);
      }
      intervalDays = Math.min(intervalDays, MAX_INTERVAL_DAYS);
      repetitions = state.repetitions + 1;
      cardState = "REVIEW";
    }

    const next: SRSState = {
      ...state,
      state: cardState,
      easeFactor,
      intervalDays,
      repetitions,
      lapses,
      dueAt: addDays(now, intervalDays),
      lastReviewedAt: new Date(now.getTime()),
    };

    return { next };
  }
}
