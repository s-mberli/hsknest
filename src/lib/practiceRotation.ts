import type { PracticeModeKey } from "@/lib/practiceModes";

/**
 * Rotation: the variety layer over Practice modes.
 *
 * Picks which Practice screen runs next. It never grades, queues, or
 * schedules — a Practice answer is logged but leaves the schedule untouched,
 * and nothing here may produce a Review.
 *
 * Pure by design: no React, DOM, or network dependency, and `rng` is
 * injectable so the rules are deterministic under test (same pattern as
 * src/lib/srs/modifiers.ts).
 *
 * Rules:
 * - nothing available            → null
 * - exactly one mode available   → that mode, even if it was just played
 * - two or more available        → a uniform pick that is never `previous`
 *
 * Word Ninja is not part of PracticeModeKey, so Rotation can never select it.
 */
export function selectPracticeMode(
  available: readonly PracticeModeKey[],
  previous: PracticeModeKey | null = null,
  rng: () => number = Math.random
): PracticeModeKey | null {
  if (available.length === 0) return null;
  if (available.length === 1) return available[0];

  const candidates = available.filter((m) => m !== previous);
  // `previous` may be absent from `available` (e.g. the language's mode list
  // changed mid-session), in which case nothing was filtered out.
  const pool = candidates.length > 0 ? candidates : available;

  // Clamp: a caller-supplied rng returning exactly 1 (or drifting out of
  // range) must not index past the end.
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  return pool[index];
}
