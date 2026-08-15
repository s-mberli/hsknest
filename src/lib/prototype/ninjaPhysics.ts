// PROTOTYPE — throwaway code, not wired to SRS/Prisma/network. Safe to delete.

import type { NinjaTile, StageBounds } from "./ninjaTypes";

export const GRAVITY = 420; // px/s^2 — was 1800 → 1100 → 700, ~40% slower again
export const APEX_RATIO = 0.58; // apex height as fraction of stage height from bottom

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `tile-${idCounter}-${Date.now()}`;
}

/** Simple mulberry32 PRNG so waves can be seeded/deterministic if needed. */
export function makeRng(seed = Date.now()): () => number {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Launch a tile from the bottom of a lane, arcing up to roughly
 * APEX_RATIO of the stage height before gravity pulls it back down.
 */
export function launchTile(
  rng: () => number,
  bounds: StageBounds,
  targetY: number,
  laneIndex: number,
  laneCount: number,
  char: string,
  isTarget: boolean,
  spawnTime: number
): NinjaTile {
  const laneWidth = bounds.width / laneCount;
  const startX = laneWidth * laneIndex + laneWidth / 2;
  const startY = bounds.bottom + 40;
  const apexY = bounds.bottom - bounds.height * APEX_RATIO;
  const risePx = Math.max(startY - apexY, 10);
  const vy0 = -Math.sqrt(2 * GRAVITY * risePx); // negative = upward
  const vx = (rng() - 0.5) * 100; // ±50px/s band
  const spinRate = 0; // no rotation — spinning made tiles hard to read

  return {
    id: nextId(),
    char,
    isTarget,
    position: { x: startX, y: startY },
    velocity: { x: vx, y: vy0 },
    spinRate,
    sliced: false,
    spawnTime,
  };
}

/** Mutates tile in place: applies gravity and moves it by dt seconds. */
export function stepTile(tile: NinjaTile, bounds: StageBounds, dt: number): void {
  tile.velocity.y += GRAVITY * dt;
  tile.position.x += tile.velocity.x * dt;
  tile.position.y += tile.velocity.y * dt;

  // Clamp tile horizontal position to the stage — prevents off-screen drift on mobile.
  // Tile is assumed to be ~79–130px diameter, so radius ≈ 39–65px; use conservative 70px.
  const TILE_RADIUS_CLAMP = 70;
  tile.position.x = Math.max(
    TILE_RADIUS_CLAMP,
    Math.min(tile.position.x, bounds.width - TILE_RADIUS_CLAMP)
  );
}

export function tileIsOffStage(tile: NinjaTile, bounds: StageBounds): boolean {
  return tile.position.y > bounds.bottom + 100;
}
