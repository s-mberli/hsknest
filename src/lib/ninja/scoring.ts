/**
 * Scoring: map outcomes (slice speed, hit target/distractor/miss) to SRS quality grades.
 * Reuses QUALITY_BY_DIRECTION values from src/lib/grading.ts to stay in sync.
 */

import type { WaveOutcome } from "./types";

// From Phase 0 tuning
export const FAST_MS = 1200; // quality 5 if sliced faster than this
export const SLOW_MS = 3000; // quality 4 if sliced between FAST and SLOW
export const LIVES = 3;
export const WAVES_PER_SESSION = 12;

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
 * Compute a session grade (S/A/B/C) from session stats.
 * S: 11–12 correct, best combo ≥ 5
 * A: 9–10 correct, or 11–12 correct with combo < 5
 * B: 6–8 correct
 * C: ≤ 5 correct
 */
export function gradeForSession(correct: number, combo: number): "S" | "A" | "B" | "C" {
  if (correct >= 11 && combo >= 5) return "S";
  if (correct >= 9) return "A";
  if (correct >= 6) return "B";
  return "C";
}

/**
 * Difficulty curve parameters for the session.
 * As waveIndex advances, escalate cognitive load:
 * - waveSize steps from 4 to 5
 * - leadInMs tightens from 1300 to ~1050
 * - Wave-type odds shift toward Listen & Slice + Reverse waves
 * - Distractors get closer to target (higher difficulty)
 */
export interface DifficultyParams {
  waveSize: number;
  leadInMs: number;
  listenChance: number;
  reverseChance: number;
  distractorCloseness: number; // 0=loose frequency match, 1=tight
}

export function getDifficultyParams(waveIndex: number, totalWaves: number = WAVES_PER_SESSION): DifficultyParams {
  // Normalize waveIndex to 0–1 range
  const progress = Math.min(1, waveIndex / Math.max(totalWaves - 1, 1));

  // waveSize: 4 for first 8 waves, steps to 5 for waves 9+
  const waveSize = waveIndex >= 9 ? 5 : 4;

  // leadInMs: linear tighten from 1300 to 1050
  const leadInMs = Math.max(1050, 1300 - progress * 250);

  // Wave-type odds: shift toward Listen & Slice + Reverse as session progresses
  // Early game: 20% Listen, 15% Reverse (65% Gloss)
  // Late game: 35% Listen, 30% Reverse (35% Gloss)
  const listenChance = 0.2 + progress * 0.15;
  const reverseChance = 0.15 + progress * 0.15;

  // Distractor closeness: as waveIndex increases, prefer tighter frequency neighbors
  // This is used by pickDistractors to bias selection (0=any, 1=very close)
  const distractorCloseness = Math.min(1, progress * 0.5);

  return { waveSize, leadInMs, listenChance, reverseChance, distractorCloseness };
}
