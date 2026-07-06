import { addDays, type ReviewQuality, type SRSResult, type SRSState } from "./types";

/** User-tunable scheduling knobs applied AFTER any strategy computes a result. */
export interface UserSRSPrefs {
  intervalModifier: number;
  lapseModifier: number;
  masteryThresholdDays: number | null;
  fuzzIntervals: boolean;
}

/**
 * Pure post-processor: composes user tuning onto a raw algorithm result.
 * Never mutates its inputs. `rng` is injectable for deterministic tests.
 *
 * - success (quality >= 3): intervalDays *= intervalModifier
 * - lapse (quality < 3, lapseModifier > 0): intervalDays = max(1, prevInterval * lapseModifier)
 * - fuzz (fuzzIntervals && intervalDays >= 2): *= (0.95 + rng() * 0.10)  (±5%)
 * - mastery (masteryThresholdDays set && intervalDays >= threshold): state -> MASTERED
 * - dueAt recomputed as now + adjusted intervalDays
 */
export function applyUserModifiers(
  prev: SRSState,
  result: SRSResult,
  quality: ReviewQuality,
  prefs: UserSRSPrefs,
  now: Date,
  rng: () => number = Math.random
): SRSResult {
  const base = result.next;
  let intervalDays = base.intervalDays;
  let state = base.state;

  if (quality >= 3) {
    intervalDays *= prefs.intervalModifier;
  } else if (prefs.lapseModifier > 0) {
    intervalDays = Math.max(1, prev.intervalDays * prefs.lapseModifier);
  }

  if (prefs.fuzzIntervals && intervalDays >= 2) {
    intervalDays *= 0.95 + rng() * 0.1;
  }

  if (
    prefs.masteryThresholdDays !== null &&
    prefs.masteryThresholdDays > 0 &&
    intervalDays >= prefs.masteryThresholdDays
  ) {
    state = "MASTERED";
  }

  const next: SRSState = {
    ...base,
    state,
    intervalDays,
    dueAt: addDays(now, intervalDays),
  };

  return { next };
}
