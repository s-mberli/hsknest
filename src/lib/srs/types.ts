/** 0–5 quality scale. Swipe LEFT maps to 1 (forgot), swipe RIGHT to 4 (knew). */
export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

export type CardState =
  | "NEW"
  | "LEARNING"
  | "REVIEW"
  | "LAPSED"
  | "MASTERED"
  | "ASSUMED";

export type SRSAlgorithmType = "SM2" | "LEITNER" | "FSRS";

/** Algorithm-agnostic snapshot — mirrors UserProgress columns. */
export interface SRSState {
  state: CardState;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  box: number;
  lapses: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
  srsData?: Record<string, unknown>;
}

export interface SRSResult {
  /** full replacement state */
  next: SRSState;
}

export interface SRSAlgorithm {
  readonly id: SRSAlgorithmType;
  /** Initial state for a card never reviewed. */
  initialState(now: Date): SRSState;
  /** Pure: (state, quality, now) → next state. Never mutates input. */
  calculateNextReview(
    state: SRSState,
    quality: ReviewQuality,
    now: Date
  ): SRSResult;
}

/** Add `days` days to a date without mutating the input. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
