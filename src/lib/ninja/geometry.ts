/**
 * Geometric primitives for hit-testing: point-segment distance, segment-circle
 * intersection. Used by both unit tests and the engine.
 */

import type { Point } from "./types";

/**
 * Squared distance from point (px, py) to the closest point on the line segment
 * from (ax, ay) to (bx, by). Used to determine if a pointer stroke passes through
 * a tile's circular hit zone.
 */
export function pointSegmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy;
}

/**
 * Test if a line segment (ax,ay)-(bx,by) intersects a circle at (cx, cy)
 * with the given radius. Returns true if any part of the segment is within
 * the circle's boundary.
 */
export function segmentCircleHit(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  return pointSegmentDistanceSq(cx, cy, ax, ay, bx, by) <= r * r;
}

/**
 * Swept-slice hit test: check if a pointer trail segment (from p1 to p2) hits a
 * circular tile at its current position. tileStart is reserved for continuous
 * collision but is currently unused (MVP uses static tile position test).
 *
 * @param pointerStart Start of pointer trail segment
 * @param pointerEnd End of pointer trail segment
 * @param tileStart Tile position at segment start (unused in MVP)
 * @param tileEnd Tile position at segment end (current position)
 * @param radius Hit radius of the tile
 */
export function sweptSliceHit(
  pointerStart: Point,
  pointerEnd: Point,
  tileStart: Point,
  tileEnd: Point,
  radius: number
): boolean {
  void tileStart; // reserved for future continuous collision; unused now
  return segmentCircleHit(
    pointerStart.x,
    pointerStart.y,
    pointerEnd.x,
    pointerEnd.y,
    tileEnd.x,
    tileEnd.y,
    radius
  );
}

/**
 * Calculate pointer speed in pixels per second given two trail points and the
 * time elapsed between them.
 */
export function pointerSpeedPx_s(p1: Point, p2: Point, dtSeconds: number): number {
  if (dtSeconds <= 0) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy) / dtSeconds;
}
