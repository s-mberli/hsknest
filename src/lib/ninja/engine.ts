/**
 * Core game engine logic: wave spawning, physics stepping, hit detection, outcome resolution.
 * State is mutated in place on the engine; React only re-renders on discrete outcomes.
 */

import { GRAVITY, makeRng, launchTile, stepTile, tileIsOffStage } from "./physics";
import { laneLayout } from "./layout";
import { sweptSliceHit, pointerSpeedPx_s } from "./geometry";
import { qualityForOutcome, FAST_MS, SLOW_MS, LIVES, WAVES_PER_SESSION } from "./scoring";
import type { EngineState, NinjaItem, StageBounds, TrailPoint } from "./types";
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

export const DEFAULT_CONFIG: EngineConfig = {
  leadInMs: 1300,
  waveSize: 4,
  trailMs: 250,
  minSliceSpeed: 160,
  hitRadiusRatio: 0.9,
  hitRadiusPadPx: 14,
  tileSizeVw: 8,
  tileSizePxMin: 44,
  tileSizePxMax: 72,
  trailCap: 32,
  // 900ms was too short to read "Missed — X was Y" before the next wave spawned.
  // Bumped to give the corrective-feedback banner room to actually be read.
  advancePauseMs: 1700,
};

/**
 * Spawn a wave with one target and (waveSize-1) distractors.
 */
export function spawnWave(
  state: EngineState,
  targetWord: NinjaWord,
  distractorPool: NinjaWord[],
  rng: () => number,
  now: number,
  waveSize: number = 4
): void {
  const layout = laneLayout(state.stageBounds, waveSize);

  state.promptWord = { char: targetWord.term, translation: targetWord.translation };
  state.tiles = [];
  state.leadInEnd = now + state.leadInMs;
  state.waveEndTime = null;
  state.waveStatus = "lead-in";

  // Pick distractors
  const distractors = pickDistractors(targetWord, distractorPool, rng, layout.laneCount - 1);

  // Spawn tiles: target in first lane, distractors in remaining lanes
  const allWords = [targetWord, ...distractors];
  for (let i = 0; i < allWords.length; i++) {
    const tile = launchTile(
      rng,
      state.stageBounds,
      i,
      layout.laneCount,
      allWords[i].term,
      i === 0, // first tile is target
      now,
      state.stageBounds.width / layout.laneCount
    );
    state.tiles.push(tile);
  }
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

      // Slice occurred
      tile.sliced = true;
      const msToSlice = now - state.leadInEnd;

      if (tile.isTarget) {
        state.combo += 1;
        state.correct += 1;
        const quality = qualityForOutcome({
          wordId: "dummy", // filled by caller
          slicedTarget: true,
          slicedDistractor: false,
          missed: false,
          msToSlice,
          quality: 3,
        });
        resolveWave(state, "correct", now);
        return {
          wordId: "dummy",
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
          wordId: "dummy",
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
