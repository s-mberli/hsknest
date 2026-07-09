import {
  SRSAlgorithm,
  SRSState,
  SRSResult,
  ReviewQuality,
  addDays,
} from "./types";

// FSRS-5 defaults, py-fsrs vX.Y.Z, retrieved 2026-07-08
const w = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6622
];

const DECAY = -0.5;
const FACTOR = 19 / 81;

// Hard ceiling on any scheduled interval, matching sm2.ts / modifiers.ts.
// Guards against runaway stability producing absurd (or Date-overflowing) gaps.
const MAX_INTERVAL_DAYS = 10950; // ~30 years

// NOTE (MVP simplifications vs. the full FSRS-5 spec):
// - Difficulty update omits FSRS-5's linear-damping term and mean-reverts to the
//   baseline weight w[4] rather than D0(Easy). Close in practice, not identical.
// - Retrievability uses the *scheduled* intervalDays as elapsed time rather than
//   the true (now − lastReviewedAt) gap, so early/late reviews aren't yet priced
//   in. Both are tracked as follow-ups; behavior is stable and bounded.

type FSRSData = {
  v: 1;
  s: number;
  d: number;
};

export class FSRSAlgorithm implements SRSAlgorithm {
  readonly id = "FSRS";
  private desiredRetention: number;

  constructor(desiredRetention: number = 0.90) {
    this.desiredRetention = desiredRetention;
  }

  initialState(now: Date): SRSState {
    return {
      state: "NEW",
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      box: 1,
      lapses: 0,
      dueAt: now,
      lastReviewedAt: null,
      srsData: undefined,
    };
  }

  calculateNextReview(
    state: SRSState,
    quality: ReviewQuality,
    now: Date
  ): SRSResult {
    // 1. Grade mapping
    // 0, 1, 2 -> 1 (Again)
    // 3 -> 2 (Hard)
    // 4 -> 3 (Good)
    // 5 -> 4 (Easy)
    let grade = 1;
    if (quality === 3) grade = 2;
    else if (quality === 4) grade = 3;
    else if (quality === 5) grade = 4;

    const isSuccess = quality >= 3;

    // 2. Hydration
    const fsrsData = state.srsData?.fsrs as FSRSData | undefined;
    let S: number;
    let D: number;
    
    if (!fsrsData) {
      if (state.intervalDays > 0) {
        // Hydrating from SM2/Leitner
        S = Math.max(state.intervalDays, 0.1);
        D = this.clampD(w[4] - Math.exp(w[5] * (3 - 1)) + 1); // D0(Good)
      } else {
        // First review
        S = w[grade - 1];
        D = this.clampD(w[4] - Math.exp(w[5] * (grade - 1)) + 1);
        
        const nextInterval = this.getInterval(S);
        return {
          next: {
            ...state,
            state: isSuccess ? "REVIEW" : "LEARNING",
            intervalDays: nextInterval,
            repetitions: isSuccess ? 1 : 0,
            lapses: isSuccess ? state.lapses : state.lapses + 1,
            dueAt: addDays(now, nextInterval),
            lastReviewedAt: now,
            srsData: {
              ...state.srsData,
              fsrs: { v: 1, s: S, d: D }
            }
          }
        };
      }
    } else {
      S = fsrsData.s;
      D = fsrsData.d;
    }

    // 3. Retrievability
    const t = state.intervalDays > 0 ? state.intervalDays : 0;
    const R = Math.pow(1 + FACTOR * t / S, DECAY);

    // 4. Update Stability
    let nextS: number;
    if (grade === 1) { // Again (Lapse)
      nextS = w[11] * Math.pow(D, -w[12]) * Math.pow(S + 1, w[13]) * Math.exp((1 - R) * w[14]);
      nextS = Math.min(nextS, S);
    } else { // Success
      const hardPenalty = grade === 2 ? w[15] : 1;
      const easyBonus = grade === 4 ? w[16] : 1;
      nextS = S * (1 + Math.exp(w[8]) * (11 - D) * Math.pow(S, -w[9]) * (Math.exp((1 - R) * w[10]) - 1) * hardPenalty * easyBonus);
    }

    // 5. Update Difficulty
    let nextD = D - w[6] * (grade - 3);
    nextD = w[7] * w[4] + (1 - w[7]) * nextD; // Mean reversion to baseline (w[4])
    nextD = this.clampD(nextD);

    // 6. Calculate Next Interval
    const nextInterval = this.getInterval(nextS);

    return {
      next: {
        ...state,
        state: isSuccess ? "REVIEW" : "LEARNING",
        intervalDays: nextInterval,
        repetitions: isSuccess ? state.repetitions + 1 : 0,
        lapses: isSuccess ? state.lapses : state.lapses + 1,
        dueAt: addDays(now, nextInterval),
        lastReviewedAt: now,
        srsData: {
          ...state.srsData,
          fsrs: { v: 1, s: nextS, d: nextD }
        }
      }
    };
  }

  private clampD(d: number): number {
    return Math.max(1, Math.min(10, d));
  }

  private getInterval(s: number): number {
    const r = this.desiredRetention;
    const I = (s / FACTOR) * (Math.pow(r, 1 / DECAY) - 1);
    // Floor at 1 day, cap at the system maximum, rounded to whole days.
    return Math.max(1, Math.min(MAX_INTERVAL_DAYS, Math.round(I)));
  }
}
