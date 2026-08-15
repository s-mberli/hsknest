/**
 * Core types for the Hanzi Ninja slice-practice mode.
 * Seeded with Phase 0 prototype constants; all units are pixels/ms.
 */

export interface Point {
  x: number;
  y: number;
}

export interface TrailPoint extends Point {
  t: number; // milliseconds, performance.now()
}

export interface StageBounds {
  width: number;
  height: number;
  bottom: number; // y-coordinate of the stage floor (typically height)
}

export interface NinjaItem {
  id: string;
  char: string; // hanzi character
  isTarget: boolean;
  position: Point;
  velocity: Point;
  spinRate: number; // degrees/sec (currently 0; no rotation)
  sliced: boolean;
  spawnTime: number; // ms, performance.now()
}

export interface WaveOutcome {
  wordId: string;
  slicedTarget: boolean;
  slicedDistractor: boolean;
  missed: boolean;
  msToSlice: number | null; // null if missed or no target sliced
  quality: 1 | 3 | 4 | 5; // from QUALITY_BY_DIRECTION or scoring rules
}

export interface SliceBurst extends Point {
  t: number; // milliseconds, performance.now(), when the slice landed
  quality?: 1 | 3 | 4 | 5; // SRS quality tier, for speed-tiered visual rendering
}

export interface EngineState {
  tiles: NinjaItem[];
  trail: TrailPoint[];
  /** Short-lived ink-splatter particle origins, one per successful slice.
   * Purely decorative — InkCanvas reads and ages these out; see
   * decaySliceBursts. */
  sliceBursts: SliceBurst[];
  pointer: Point | null;
  lives: number;
  waveIndex: number;
  combo: number;
  bestCombo: number;
  correct: number;
  missed: number;
  stageBounds: StageBounds;
  promptWord: {
    wordId: string;
    char: string;
    translation: string;
    /** True for a "Listen & Slice" wave: the prompt is audio, not a gloss —
     * `translation` still carries text (used as game-over/history copy and
     * as a fallback), but the UI shows a speaker icon instead of it. */
    isAudioPrompt?: boolean;
    /** True for a "Reverse" wave: tiles show translations, not hanzi —
     * the prompt shows the hanzi and the player slices the meaning. */
    isReverseWave?: boolean;
  };
  waveStatus: "lead-in" | "live" | "resolved" | "game-over";
  leadInEnd: number; // ms timestamp when lead-in ends
  waveEndTime: number | null; // ms timestamp when wave resolved
  leadInMs: number;
  waveSize: number;
  trailMs: number;
  /** Words to requeue (missed/wrong slices) — Map of wordId to requeue count.
   * A word requeues at most 1 time per session. */
  requeuePool: Map<string, number>;
}
