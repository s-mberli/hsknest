/**
 * Physics engine: gravity, tile launch, position/velocity stepping.
 * Fixed timestep, seeded RNG for deterministic trajectories.
 */

import type { NinjaItem, StageBounds } from "./types";
import { clampTileX } from "./layout";

// GRAVITY used to be a fixed px/s² constant (420→290→250 across earlier
// tuning passes). That made flight time scale with sqrt(stage height): a
// short phone viewport (~380px) produced a proportionally *shorter*, faster
// flight than the ~700px desktop stage this was tuned on — the mode played
// noticeably harder on the device it targets. gravityForBounds derives
// gravity per-session from the actual stage height instead, so total flight
// time stays close to TARGET_FLIGHT_S on any viewport.
// Higher apex ratio means tiles spend more time in the slow, readable zone.
export const APEX_RATIO = 0.62; // apex height as fraction of stage height (was 0.58)
/** Target total flight time (launch to apex to floor), seconds. Chosen to
 * roughly match the desktop feel of the old fixed GRAVITY=250 tuning. */
export const TARGET_FLIGHT_S = 4.0;

/**
 * Derive gravity from the stage bounds so flight time is viewport-independent.
 * Apex sits at TARGET_FLIGHT_S / 2 (symmetric rise/fall of a ballistic arc):
 * rise R = GRAVITY * (T/2)² / 2  =>  GRAVITY = 8R / T².
 */
export function gravityForBounds(bounds: StageBounds): number {
  const startY = bounds.bottom + 40;
  const apexY = bounds.bottom - bounds.height * APEX_RATIO;
  const risePx = Math.max(startY - apexY, 10);
  return (8 * risePx) / (TARGET_FLIGHT_S * TARGET_FLIGHT_S);
}

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
 * before gravity pulls it back down. Gravity is derived per-viewport (see
 * gravityForBounds) so flight time — not raw speed — stays constant across
 * screen sizes. Horizontal drift is capped at a quarter of the lane width
 * over the whole flight, scaled to laneWidth so it can never exceed lane
 * spacing regardless of viewport (previously a fixed ±50px/s, which dwarfed
 * a ~97px phone lane over a ~3s flight and guaranteed overlap).
 */
export function launchTile(
  rng: () => number,
  bounds: StageBounds,
  laneIndex: number,
  laneCount: number,
  char: string,
  isTarget: boolean,
  spawnTime: number,
  derivedLaneWidth?: number,
  fontSize?: number
): NinjaItem {
  const laneWidth = derivedLaneWidth || bounds.width / laneCount;
  const startX = laneWidth * laneIndex + laneWidth / 2;
  const startY = bounds.bottom + 40;
  const gravity = gravityForBounds(bounds);
  const apexY = bounds.bottom - bounds.height * APEX_RATIO;
  const risePx = Math.max(startY - apexY, 10);
  const vy0 = -Math.sqrt(2 * gravity * risePx); // negative = upward
  const maxDrift = laneWidth * 0.25;
  const vx = (rng() - 0.5) * ((2 * maxDrift) / TARGET_FLIGHT_S);
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
    fontSize,
  };
}

/**
 * Apply gravity and position update to a tile over dt seconds.
 * Clamp horizontal position to stay on-screen (mobile safety) using the
 * tile's real radius rather than a hardcoded guess.
 */
export function stepTile(
  tile: NinjaItem,
  bounds: StageBounds,
  dt: number,
  tileRadiusPx = 70
): void {
  const gravity = gravityForBounds(bounds);
  tile.velocity.y += gravity * dt;
  tile.position.x += tile.velocity.x * dt;
  tile.position.y += tile.velocity.y * dt;

  tile.position.x = clampTileX(tile.position.x, tileRadiusPx, bounds.width);
}

/**
 * Check if a tile has fallen off the stage floor.
 */
export function tileIsOffStage(tile: NinjaItem, bounds: StageBounds): boolean {
  return tile.position.y > bounds.bottom + 100;
}
