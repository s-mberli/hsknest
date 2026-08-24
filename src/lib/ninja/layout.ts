/**
 * Layout calculation: tile sizing, lane count, safe centre clamping.
 * Encodes the mobile safety constraint from Phase 0: no overlaps, no off-screen drift.
 */

import type { StageBounds } from "./types";

// Tile size constants from Phase 0
const TILE_SIZE_PX_MIN = 44;
const TILE_SIZE_PX_MAX = 72;
const TILE_SIZE_VW = 8;

// The circular target backdrop is 1.8× the character size
const TARGET_CIRCLE_RATIO = 1.8;

// Edge margin to prevent tiles from touching the screen edge
const EDGE_MARGIN = 10;

export interface LayoutResult {
  tileSizePx: number;
  laneCount: number;
  laneCentres: number[];
  tileRadiusPx: number;
  targetCircleDiameterPx: number;
}

/**
 * Compute layout for a given stage width. Returns tile size, safe lane count,
 * and clamped lane centre x-coordinates.
 *
 * @param bounds Stage bounds
 * @param waveSize Requested wave size (usually 4, but can be reduced on narrow viewports)
 * @returns Layout with actual lane count (≤ waveSize), tile radius, and lane centres
 */
export function laneLayout(bounds: StageBounds, waveSize: number = 4): LayoutResult {
  const { width } = bounds;

  // Compute tile size (matches CSS clamp used in render)
  const tileSizePx = Math.min(
    Math.max(
      TILE_SIZE_PX_MIN,
      (TILE_SIZE_VW / 100) * width
    ),
    TILE_SIZE_PX_MAX
  );

  // Hit radius: 0.9 ratio + 14px flat pad (from Phase 0)
  const tileRadiusPx = 0.9 * tileSizePx + 14;
  const targetDiameterPx = tileSizePx * TARGET_CIRCLE_RATIO;

  // Derive lane count: if 4 lanes don't fit without overlapping, use 3.
  // Each lane needs at least `diameterPx * 1.35` width to avoid overlap —
  // was 1.15, which left a ~390px phone needing only 91px/lane against an
  // actual 97.5px, so the 3-lane fallback never triggered on the exact
  // viewport it exists for. 1.35 also leaves headroom for the horizontal
  // drift launchTile now applies (see physics.ts).
  let laneCount = waveSize;
  const minWidthPerLane = targetDiameterPx * 1.35;
  if (width / laneCount < minWidthPerLane && laneCount > 2) {
    laneCount = 3;
  }

  // Compute lane centres, clamped to stay on-screen
  const laneWidth = width / laneCount;
  const laneCentres: number[] = [];
  for (let i = 0; i < laneCount; i++) {
    let centre = laneWidth * i + laneWidth / 2;
    // Clamp to prevent circles from leaving the stage
    centre = Math.max(
      tileRadiusPx + EDGE_MARGIN,
      Math.min(centre, width - tileRadiusPx - EDGE_MARGIN)
    );
    laneCentres.push(centre);
  }

  return {
    tileSizePx,
    laneCount,
    laneCentres,
    tileRadiusPx,
    targetCircleDiameterPx: targetDiameterPx,
  };
}

/**
 * Clamp a tile's horizontal position to the safe stage area.
 */
export function clampTileX(x: number, radius: number, width: number): number {
  return Math.max(radius + EDGE_MARGIN, Math.min(x, width - radius - EDGE_MARGIN));
}
