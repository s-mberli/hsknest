/**
 * Core game engine logic: wave spawning, physics stepping, hit detection, outcome resolution.
 * State is mutated in place on the engine; React only re-renders on discrete outcomes.
 */

import { launchTile, stepTile, tileIsOffStage } from "./physics";
import { laneLayout } from "./layout";
import { sweptSliceHit, pointerSpeedPx_s } from "./geometry";
import { qualityForOutcome, pointsForSlice } from "./scoring";
import type { EngineState, NinjaItem } from "./types";
import type { NinjaWord } from "./distractors";
import { pickDistractors } from "./distractors";

export interface EngineConfig {
  leadInMs: number;
  waveSize: number;
  trailMs: number;
  minSliceSpeed: number;
  hitRadiusRatio: number;
  hitRadiusPadPx: number;
  tileSizeVw: number;
  tileSizePxMin: number;
  tileSizePxMax: number;
  trailCap: number;
  advancePauseMs: number;
}

/** Lifetime of an ink-splatter particle burst, in ms — purely decorative. */
export const SLICE_BURST_MS = 220;

export const DEFAULT_CONFIG: EngineConfig = {
  leadInMs: 700, // Prompt-first beat: show prompt ~700ms, then launch tiles
  waveSize: 4,
  trailMs: 250,
  minSliceSpeed: 160,
  hitRadiusRatio: 0.9,
  hitRadiusPadPx: 14,
  tileSizeVw: 8,
  tileSizePxMin: 44,
  tileSizePxMax: 72,
  trailCap: 32,
  // Asymmetric pause: correct answers advance quickly (preserved flow);
  // misses/wrong slices get ~3s to read the correction. Read below how this
  // is applied in useNinjaEngine.ts:advanceTimerRef.
  advancePauseMs: 1700, // Now the base (for correct). Misses get ~3000ms.
};

/** Same step ladder Part B replaced per-tile sizing with, now applied once
 * per wave (to the longest term) instead of once per tile — see
 * launchWaveTiles below. */
function waveFontSize(longestTerm: string): string {
  const len = longestTerm.length;
  if (len <= 2) return "clamp(44px, 8vw, 72px)";
  if (len <= 4) return "clamp(26px, 6vw, 42px)";
  if (len <= 8) return "clamp(17px, 4.2vw, 28px)";
  return "clamp(12px, 3.2vw, 20px)";
}

/**
 * Lay out and launch tiles for a wave: target first, then the given
 * distractors filling the remaining lanes. Shared by every wave-spawning
 * function below — only how the distractors get chosen differs.
 */
function launchWaveTiles(
  state: EngineState,
  targetWord: NinjaWord,
  distractors: NinjaWord[],
  rng: () => number,
  now: number,
  waveSize: number
): void {
  const layout = laneLayout(state.stageBounds, waveSize);

  state.tiles = [];
  state.leadInEnd = now + state.leadInMs;
  state.waveEndTime = null;
  state.waveStatus = "lead-in";

  // Shuffle lane order (Fisher-Yates, driven by the session's seeded rng so
  // it stays deterministic/testable) — otherwise the target is always
  // allWords[0], i.e. always the leftmost tile, every single wave.
  const allWords = [targetWord, ...distractors];
  for (let i = allWords.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allWords[i], allWords[j]] = [allWords[j], allWords[i]];
  }

  // One size for the whole wave, derived from its longest term — sizing
  // each tile independently by its own term length made same-wave tiles
  // look randomly mismatched (a 72px tile next to a 20px one).
  const longestTerm = allWords.reduce((a, b) => (b.term.length > a.length ? b.term : a), "");
  const fontSize = waveFontSize(longestTerm);

  for (let i = 0; i < allWords.length; i++) {
    const tile = launchTile(
      rng,
      state.stageBounds,
      i,
      layout.laneCount,
      allWords[i].term,
      allWords[i].wordId === targetWord.wordId,
      now,
      state.stageBounds.width / layout.laneCount,
      fontSize
    );
    state.tiles.push(tile);
  }
}

/**
 * Spawn a wave with one target and (waveSize-1) distractors, prompted by
 * the target's English gloss.
 */
export function spawnWave(
  state: EngineState,
  targetWord: NinjaWord,
  distractorPool: NinjaWord[],
  rng: () => number,
  now: number,
  waveSize: number = 4,
  distractorCloseness: number = 0
): void {
  state.promptWord = {
    wordId: targetWord.wordId,
    char: targetWord.term,
    translation: targetWord.translation,
    phonetic: targetWord.phonetic,
  };

  const layout = laneLayout(state.stageBounds, waveSize);
  const distractors = pickDistractors(
    targetWord,
    distractorPool,
    rng,
    layout.laneCount - 1,
    distractorCloseness
  );
  launchWaveTiles(state, targetWord, distractors, rng, now, waveSize);
}

export interface WaveOutcome {
  wordId: string;
  slicedTarget: boolean;
  slicedDistractor: boolean;
  missed: boolean;
  msToSlice: number | null;
  quality: 1 | 3 | 4 | 5;
}

/**
 * Step physics: move tiles, remove off-stage ones, detect if target fell.
 */
export function stepPhysics(state: EngineState, dt: number, now: number): void {
  const bounds = state.stageBounds;
  const kept: NinjaItem[] = [];

  for (const tile of state.tiles) {
    if (tile.sliced) {
      kept.push(tile);
      continue;
    }

    stepTile(tile, bounds, dt);

    if (tileIsOffStage(tile, bounds)) {
      if (tile.isTarget && state.waveStatus === "live") {
        resolveWave(state, "missed", now);
      }
      continue;
    }

    kept.push(tile);
  }

  state.tiles = kept;
}

/**
 * Check if pointer trail sliced any tiles. Test every segment (not just the newest).
 * Returns the outcome if a slice occurred, null otherwise.
 */
export function stepHitTests(
  state: EngineState,
  config: EngineConfig,
  now: number
): WaveOutcome | null {
  if (state.waveStatus !== "live" || !state.pointer || state.trail.length < 2) {
    return null;
  }

  // Compute hit radius to match rendered tile size
  const tileSizePx = Math.min(
    Math.max(
      config.tileSizePxMin,
      (config.tileSizeVw / 100) * state.stageBounds.width
    ),
    config.tileSizePxMax
  );
  const radius = config.hitRadiusRatio * tileSizePx + config.hitRadiusPadPx;

  // Test all consecutive trail segments
  for (let i = 1; i < state.trail.length; i += 1) {
    const p1 = state.trail[i - 1];
    const p2 = state.trail[i];
    const dt = (p2.t - p1.t) / 1000;
    if (dt <= 0) continue;

    const speed = pointerSpeedPx_s(p1, p2, dt);
    if (speed < config.minSliceSpeed) continue;

    for (const tile of state.tiles) {
      if (tile.sliced) continue;

      const hit = sweptSliceHit(p1, p2, tile.position, tile.position, radius);
      if (!hit) continue;

      // Slice occurred. Grading is always against the target word — a wrong
      // slice means "didn't recognise the target", not "knows the
      // distractor", so the SRS write always targets promptWord.wordId,
      // never the sliced distractor's own id.
      tile.sliced = true;
      const msToSlice = now - state.leadInEnd;
      const wordId = state.promptWord.wordId;

      if (tile.isTarget) {
        state.combo += 1;
        state.correct += 1;
        const quality = qualityForOutcome({
          wordId,
          slicedTarget: true,
          slicedDistractor: false,
          missed: false,
          msToSlice,
          quality: 3,
        });
        state.score += pointsForSlice(quality, state.combo);
        state.sliceBursts.push({ x: tile.position.x, y: tile.position.y, t: now, quality });
        resolveWave(state, "correct", now);
        return {
          wordId,
          slicedTarget: true,
          slicedDistractor: false,
          missed: false,
          msToSlice,
          quality,
        };
      } else {
        state.lives -= 1;
        state.combo = 0;
        resolveWave(state, "wrong", now);
        return {
          wordId,
          slicedTarget: false,
          slicedDistractor: true,
          missed: false,
          msToSlice,
          quality: 1,
        };
      }
    }
  }

  return null;
}

/**
 * Mark a wave as resolved and check for game over.
 */
export function resolveWave(
  state: EngineState,
  kind: "correct" | "wrong" | "missed",
  now: number
): void {
  if (state.waveStatus !== "live") return;

  state.waveStatus = "resolved";
  state.waveEndTime = now;

  if (kind === "missed") {
    state.missed += 1;
    state.combo = 0;
    // Letting the target fall must cost a life same as slicing the wrong
    // tile — otherwise standing still is a safe strategy and lives only
    // track wrong slices, not "didn't answer at all".
    state.lives -= 1;
  }

  state.bestCombo = Math.max(state.bestCombo, state.combo);

  // Do NOT jump straight to "game-over" here even when lives just hit 0.
  // Staying in "resolved" lets the corrective-feedback banner (the prompt
  // card flipping red) show for advancePauseMs, same as every other wave —
  // otherwise the last mistake of a session never reveals the right answer
  // before the game-over screen covers it. useNinjaEngine's advance timer
  // is the sole place that transitions to "game-over", after the pause.
}

/**
 * Decay trail points older than trailMs.
 */
export function decayTrail(state: EngineState, config: EngineConfig, now: number): void {
  while (state.trail.length && now - state.trail[0].t > config.trailMs) {
    state.trail.shift();
  }
}

/** Drop ink-splatter bursts older than SLICE_BURST_MS. */
export function decaySliceBursts(state: EngineState, now: number): void {
  if (state.sliceBursts.length === 0) return;
  state.sliceBursts = state.sliceBursts.filter((b) => now - b.t < SLICE_BURST_MS);
}

/**
 * Check if wave should transition to "live" (lead-in expired).
 */
export function stepWaveLogic(state: EngineState, now: number): void {
  if (state.waveStatus === "lead-in" && now >= state.leadInEnd) {
    state.waveStatus = "live";
  }

  // Game-over on lives<=0 is decided by useNinjaEngine's advance timer, not
  // here — see the comment in resolveWave for why.
}
