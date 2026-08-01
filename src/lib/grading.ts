/**
 * Single source of truth for SM-2/FSRS grade semantics shared across the
 * study screen (swipe gestures) and the practice screens (quiz/sentence/
 * match, which grade via buttons). Quality is always one of {1, 3, 4, 5} —
 * 2 ("hard-fail") is not used anywhere in this app.
 *
 * Semantics (matches FSRS/Anki): only Again (1) is a failed recall. Hard
 * (3), Good (4), and Easy (5) are all successful recalls — Hard is just a
 * harder one. If "Hard" visibly cost the user their streak, they'd stop
 * clicking it honestly and the scheduler would get corrupted input.
 */

export type SwipeDirection = "left" | "right" | "up" | "down";

/** Grade gestures map to SM-2 qualities. */
export const QUALITY_BY_DIRECTION: Record<SwipeDirection, number> = {
  left: 1, // forgot
  down: 3, // hard / barely
  right: 4, // knew
  up: 5, // easy
};

/** Was this grade a successful recall? Only Again (quality < 3) fails. */
export function isPass(quality: number): boolean {
  return quality >= 3;
}

/** Does this grade break the combo streak? Equivalent to !isPass today. */
export function breaksStreak(quality: number): boolean {
  return !isPass(quality);
}

/**
 * SM-2 step 7: does this grade re-queue the card later in the same session?
 * Deliberately a *different* threshold from isPass — Hard (3) still passes
 * and extends the streak, but is weak enough to warrant another look before
 * the session ends.
 */
export function requeuesInSession(quality: number): boolean {
  return quality < 4;
}

export interface GradeLabel {
  quality: number;
  label: string;
  className: string;
}

/** Canonical label + styling per quality, ordered Again → Hard → Good → Easy. */
export const GRADE_LABELS: GradeLabel[] = [
  { quality: 1, label: "Again", className: "text-destructive border-destructive/40 hover:bg-destructive/10" },
  { quality: 3, label: "Hard", className: "text-amber border-amber/40 hover:bg-amber/10" },
  { quality: 4, label: "Good", className: "text-success border-success/40 hover:bg-success/10" },
  { quality: 5, label: "Easy", className: "text-sky-600 dark:text-sky-400 border-sky-500/40 hover:bg-sky-500/10" },
];
