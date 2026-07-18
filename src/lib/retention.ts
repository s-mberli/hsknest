/**
 * Projected retention curves — a display-oriented estimate of recall
 * probability over time, derived from SM-2 state. Pure/derivation only: no
 * I/O, no Prisma types.
 *
 * Model: R(t) = exp(-t / (intervalDays * k(easeFactor))), a simple
 * exponential forgetting curve scaled so the review interval itself sits at
 * a "target" retention rather than decaying to near-zero by the next
 * review. k(easeFactor) maps SM-2's ease factor (typically 1.3-2.5+) onto a
 * gentle multiplier: higher ease (word "sticks" better, longer intervals
 * assigned) implies a flatter/slower decay curve. We anchor k=1 at
 * ease=2.5 (SM-2's default/starting ease) and scale roughly linearly, floored
 * so a minimum-ease card still produces a sane (if steep) curve.
 */

export interface RetentionInput {
  intervalDays: number | null;
  easeFactor: number | null;
}

const DEFAULT_EASE = 2.5;
const MIN_K = 0.6;

/** Ease factor -> curve-shape multiplier k. Higher ease = flatter decay. */
function k(easeFactor: number | null): number {
  const ease = easeFactor ?? DEFAULT_EASE;
  const scaled = ease / DEFAULT_EASE;
  return Math.max(MIN_K, scaled);
}

/**
 * Sample the projected retention curve at `points` evenly spaced steps from
 * t=0 (now) to t=intervalDays. Returns values in [0, 1].
 *
 * When intervalDays is missing/0/negative, there's no meaningful window to
 * project over — returns a flat low curve (0.5 at t=0, decaying trivially)
 * so callers can still render *something* rather than branching on null.
 */
export function retentionCurve(
  input: RetentionInput,
  points: number
): number[] {
  const n = Math.max(2, Math.floor(points));
  const interval = input.intervalDays;

  if (interval == null || !Number.isFinite(interval) || interval <= 0) {
    // No real interval to project — flat low curve, still `points` long.
    return Array.from({ length: n }, () => 0.5);
  }

  const scale = interval * k(input.easeFactor);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (interval * i) / (n - 1);
    out.push(Math.exp(-t / scale));
  }
  return out;
}

/**
 * Current projected retention "now" for a word, given how far into its
 * interval it is (0 = just reviewed, 1 = exactly at the due date). Returns
 * null when there's no interval to project from (e.g. NEW words).
 */
export function retentionNow(
  word: RetentionInput & { dueAt: string | null },
  now: number
): number | null {
  const interval = word.intervalDays;
  if (interval == null || !Number.isFinite(interval) || interval <= 0) {
    return null;
  }
  if (!word.dueAt) return null;
  const due = new Date(word.dueAt).getTime();
  if (Number.isNaN(due)) return null;

  const dueInMs = interval * 24 * 60 * 60 * 1000;
  const lastReviewedAt = due - dueInMs;
  const elapsedDays = Math.max(0, (now - lastReviewedAt) / (24 * 60 * 60 * 1000));

  const scale = interval * k(word.easeFactor);
  return Math.exp(-elapsedDays / scale);
}
