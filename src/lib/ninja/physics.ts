/**
 * Physics engine: gravity, tile launch, position/velocity stepping.
 * Fixed timestep, seeded RNG for deterministic trajectories.
 */

import type { NinjaItem, StageBounds } from "./types";

export const GRAVITY = 420; // px/s² — tuned in Phase 0
export const APEX_RATIO = 0.58; // apex height as fraction of stage height

/** Simple mulberry32 PRNG for seeded, deterministic waves. */
export function makeRng(seed = 0): () => number {
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
 * Launch a tile from a lane, arcing upward to APEX_RATIO of stage height
 * before gravity pulls it back down. Horizontal drift is ±50px/s.
 */
export function launchTile(
  rng: () => number,
  bounds: StageBounds,
  laneIndex: number,
  laneCount: number,
  char: string,
  isTarget: boolean,
  spawnTime: number,
  derivedLaneWidth?: number
): NinjaItem {
  const laneWidth = derivedLaneWidth || bounds.width / laneCount;
  const startX = laneWidth * laneIndex + laneWidth / 2;
  const startY = bounds.bottom + 40;
  const apexY = bounds.bottom - bounds.height * APEX_RATIO;
  const risePx = Math.max(startY - apexY, 10);
  const vy0 = -Math.sqrt(2 * GRAVITY * risePx); // negative = upward
  const vx = (rng() - 0.5) * 100; // ±50 px/s
  const spinRate = 0; // no rotation

  return {
    id: `tile-${laneIndex}-${spawnTime}`,
    char,
    isTarget,
    position: { x: startX, y: startY },
    velocity: { x: vx, y: vy0 },
    spinRate,
    sliced: false,
    spawnTime,
  };
}

/**
 * Apply gravity and position update to a tile over dt seconds.
 * Clamp horizontal position to stay on-screen (mobile safety).
 */
export function stepTile(tile: NinjaItem, bounds: StageBounds, dt: number): void {
  tile.velocity.y += GRAVITY * dt;
  tile.position.x += tile.velocity.x * dt;
  tile.position.y += tile.velocity.y * dt;

  // Clamp to stage bounds. Use 70px as a conservative tile radius.
  const CLAMP_RADIUS = 70;
  tile.position.x = Math.max(
    CLAMP_RADIUS,
    Math.min(tile.position.x, bounds.width - CLAMP_RADIUS)
  );
}

/**
 * Check if a tile has fallen off the stage floor.
 */
export function tileIsOffStage(tile: NinjaItem, bounds: StageBounds): boolean {
  return tile.position.y > bounds.bottom + 100;
}
