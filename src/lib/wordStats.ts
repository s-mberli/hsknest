/**
 * Small display-oriented stat helpers derived from SRS progress state.
 * Pure/derivation only: no I/O, no Prisma types.
 */

export interface MasteryInput {
  intervalDays: number | null;
}

/** Fallback mastery threshold (days) when the user hasn't set one. */
export const DEFAULT_MASTERY_THRESHOLD_DAYS = 60;

/**
 * Mastery percentage: how far along `intervalDays` is toward the mastery
 * threshold, clamped to [0, 100]. Missing/invalid interval -> 0.
 */
export function mastery(
  word: MasteryInput,
  masteryThresholdDays: number | null | undefined
): number {
  const threshold =
    masteryThresholdDays && masteryThresholdDays > 0
      ? masteryThresholdDays
      : DEFAULT_MASTERY_THRESHOLD_DAYS;
  const interval = word.intervalDays;
  if (interval == null || !Number.isFinite(interval) || interval <= 0) return 0;
  const pct = (interval / threshold) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export interface StreakInput {
  repetitions: number | null;
}

/**
 * Current consecutive-success streak. SM-2's `repetitions` already resets to
 * 0 on a lapse, so this is a null-safe passthrough.
 */
export function streak(word: StreakInput): number {
  return word.repetitions ?? 0;
}
