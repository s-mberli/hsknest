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

export interface EngineState {
  tiles: NinjaItem[];
  trail: TrailPoint[];
  pointer: Point | null;
  lives: number;
  waveIndex: number;
  combo: number;
  bestCombo: number;
  correct: number;
  missed: number;
  stageBounds: StageBounds;
  promptWord: { char: string; translation: string };
  waveStatus: "lead-in" | "live" | "resolved" | "game-over";
  leadInEnd: number; // ms timestamp when lead-in ends
  waveEndTime: number | null; // ms timestamp when wave resolved
}
