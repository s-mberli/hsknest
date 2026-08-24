/**
 * Core types for the Word Ninja slice-practice mode.
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
  /** Font size in px, uniform across every tile in a wave (see
   * launchWaveTiles in engine.ts) — sized off the wave's longest term AND
   * the tile's real circle diameter so multi-character terms (e.g. 我们)
   * never wrap. A plain px number, not a CSS clamp() string, because it must
   * be derived from the actual rendered tile size (layout.ts), not
   * re-approximated from vw independently in three places. Optional so
   * physics-only test fixtures that build a NinjaItem by hand don't all need
   * updating; launchTile (physics.ts) and NinjaTile.tsx both default it when
   * absent. */
  fontSize?: number;
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
  /** Points score for the endless run — see pointsForSlice in scoring.ts. */
  score: number;
  stageBounds: StageBounds;
  promptWord: {
    wordId: string;
    char: string;
    translation: string;
    phonetic?: string;
  };
  waveStatus: "lead-in" | "live" | "resolved" | "game-over";
  leadInEnd: number; // ms timestamp when lead-in ends
  waveEndTime: number | null; // ms timestamp when wave resolved
  leadInMs: number;
  /** A wave queued during lead-in, not yet placed on stage — see
   * launchPendingWave in engine.ts. Tiles are deferred until lead-in ends so
   * the whole visible flight is inside the sliceable "live" window instead
   * of burning leadInMs of un-sliceable dead flight. Null once launched (or
   * before any wave has been queued). */
  pendingWave: {
    words: { wordId: string; term: string }[];
    targetWordId: string;
    laneCount: number;
    fontSize: number;
  } | null;
  waveSize: number;
  trailMs: number;
  /** Words to requeue (missed/wrong slices) — Map of wordId to how many
   * times it has already been requeued. Expanding gaps: reappears at +2
   * waves after the 1st miss, +5 after the 2nd, then stops (max 2 requeues
   * per word per run). See scheduleRequeue in useNinjaEngine.ts. */
  requeuePool: Map<string, number>;
  /** wordId -> waveIndex at which it becomes eligible to be dequeued again.
   * Paired with requeuePool to implement the expanding-gap schedule. */
  requeueReadyAt: Map<string, number>;
}
