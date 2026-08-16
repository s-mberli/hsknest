/**
 * Scoring: map outcomes (slice speed, hit target/distractor/miss) to SRS quality grades,
 * plus points/grade calculation for the endless run.
 * Reuses QUALITY_BY_DIRECTION values from src/lib/grading.ts to stay in sync.
 */

import type { WaveOutcome } from "./types";

// From Phase 0 tuning
export const FAST_MS = 1200; // quality 5 if sliced faster than this
export const SLOW_MS = 3000; // quality 4 if sliced between FAST and SLOW
export const LIVES = 3;

/**
 * Map a wave outcome (target sliced, distractor sliced, miss) and response time
 * to an SRS quality grade (1, 3, 4, 5).
 *
 * Quality tiers reuse QUALITY_BY_DIRECTION:
 *   5 = "right" swipe (correct, fast)
 *   4 = "down" swipe (correct, medium)
 *   3 = "up" swipe (correct, slow)
 *   1 = "left" swipe (incorrect / miss)
 *
 * - Target sliced < FAST_MS → quality 5
 * - Target sliced < SLOW_MS → quality 4
 * - Target sliced, slower → quality 3
 * - Distractor sliced → quality 1
 * - Target missed (fell) → quality 1
 */
export function qualityForOutcome(outcome: WaveOutcome): 1 | 3 | 4 | 5 {
  if (outcome.slicedTarget) {
    if (outcome.msToSlice === null) return 3; // shouldn't happen, fallback
    if (outcome.msToSlice < FAST_MS) return 5;
    if (outcome.msToSlice < SLOW_MS) return 4;
    return 3;
  }
  // Distractor sliced or target missed
  return 1;
}

/**
 * Validate that a quality value is in the allowed set {1, 3, 4, 5}.
 * Used by tests to ensure scoring consistency.
 */
export function isValidQuality(q: unknown): q is 1 | 3 | 4 | 5 {
  return q === 1 || q === 3 || q === 4 || q === 5;
}

/**
 * Points for a single correct slice: a base value scaled by speed tier
 * (quality 5/4/3 — see qualityForOutcome) and the combo multiplier at the
 * moment of the slice (combo already includes this slice, i.e. >=1).
 */
export function pointsForSlice(quality: 1 | 3 | 4 | 5, combo: number): number {
  const base = quality === 5 ? 100 : quality === 4 ? 70 : quality === 3 ? 40 : 0;
  const multiplier = 1 + Math.min(combo - 1, 9) * 0.1; // +10%/combo step, capped at 2x
  return Math.round(base * multiplier);
}

