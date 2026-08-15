// PROTOTYPE — throwaway code, not wired to SRS/Prisma/network. Safe to delete.

export interface Point {
  x: number;
  y: number;
}

export interface NinjaTile {
  id: string;
  char: string;
  isTarget: boolean;
  position: Point;
  velocity: Point;
  spinRate: number; // degrees/sec
  sliced: boolean;
  spawnTime: number; // ms, performance.now() at launch
}

export interface TrailPoint {
  x: number;
  y: number;
  t: number; // ms timestamp
}

export interface StageBounds {
  width: number;
  height: number;
  bottom: number;
}

export interface GameState {
  tiles: NinjaTile[];
  trail: TrailPoint[]; // ring buffer, cap 32
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

export interface WaveOutcome {
  wordId: string;
  slicedTarget: boolean;
  slicedDistractor: boolean;
  missed: boolean;
  msToSlice: number | null;
}
