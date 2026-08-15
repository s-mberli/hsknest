// PROTOTYPE — throwaway code, not wired to SRS/Prisma/network. Safe to delete.

import type { Point } from "./ninjaTypes";

/** Squared distance from point (px,py) to the closest point on segment (ax,ay)-(bx,by). */
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
 * MVP swept-slice test: test the pointer's last segment against a circle at
 * the tile's CURRENT position. Not a full continuous-collision solve —
 * intentionally simple.
 */
export function sweptSliceHit(
  pointerStart: Point,
  pointerEnd: Point,
  tileStart: Point,
  tileEnd: Point,
  radius: number
): boolean {
  void tileStart;
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

export function pointerSpeedPx_s(p1: Point, p2: Point, dtSeconds: number): number {
  if (dtSeconds <= 0) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy) / dtSeconds;
}
