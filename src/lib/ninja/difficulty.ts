/**
 * Adaptive difficulty controller for the endless run.
 *
 * Replaces the old fixed 12-wave staircase (waveIndex-driven, same for every
 * player) with a proportional controller that tracks each player's own
 * rolling accuracy and nudges difficulty toward the level that keeps them at
 * ~85% correct — the accuracy band where learning-per-attempt peaks
 * (Wilson et al. 2019, Nature Communications). Too easy wastes reps, too
 * hard just produces noise; holding everyone near their own edge beats a
 * one-size staircase.
 *
 * Deliberately does NOT touch fall speed (GRAVITY) — see the Ninja plan for
 * why raw speed is the wrong axis. Only distractorCloseness (how confusable
 * the options are) moves; leadInMs is fixed.
 */

export interface DifficultyState {
  /** Rolling window of recent outcomes, oldest first. true = correct slice. */
  history: boolean[];
  /** Current difficulty, clamped to [0, 1]. */
  level: number;
}

export const WINDOW = 8;
export const TARGET_ACCURACY = 0.85;
export const STEP = 0.06;
/** Below this many recorded outcomes, don't move the level yet — the first
 * couple of waves are too noisy a sample to steer on. */
const MIN_HISTORY = 3;

export function initialDifficultyState(): DifficultyState {
  return { history: [], level: 0 };
}

/**
 * Record an outcome and return the next difficulty state. Pure — does not
 * mutate the input.
 */
export function nextDifficulty(state: DifficultyState, wasCorrect: boolean): DifficultyState {
  const history = [...state.history, wasCorrect].slice(-WINDOW);

  if (history.length < MIN_HISTORY) {
    return { history, level: state.level };
  }

  const accuracy = history.filter(Boolean).length / history.length;
  const delta = accuracy > TARGET_ACCURACY ? STEP : accuracy < TARGET_ACCURACY ? -STEP : 0;
  const level = Math.min(1, Math.max(0, state.level + delta));

  return { history, level };
}

export interface DifficultyRunParams {
  leadInMs: number;
  distractorCloseness: number;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Map a [0,1] difficulty level to concrete wave parameters. waveSize is
 * deliberately NOT a function of level — laneLayout falls back to 3 lanes
 * below ~91px/lane, so a variable wave size would silently make late waves
 * *easier* on narrow phones. Tile count stays fixed at 4.
 *
 * leadInMs is NOT a function of level — it was inverted (higher level = longer
 * slice window) and is orthogonal to the real difficulty lever (retrieval
 * discrimination). distractorCloseness is the only axis that matters.
 */
export function paramsForLevel(level: number): DifficultyRunParams {
  return {
    leadInMs: 700, // Prompt-first beat: fixed per physics retune
    distractorCloseness: lerp(0, 1, level),
  };
}
