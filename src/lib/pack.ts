/**
 * Deterministic circle packing for the strength-bubble view. Pure/derivation
 * only: no I/O, no DOM.
 *
 * Strategy: row-fill. Circles are placed left-to-right in rows; when the next
 * circle would overflow `width`, a new row starts below the tallest circle of
 * the previous row. Simple, allocation-light, and guarantees no overlaps and
 * in-bounds placement without iterative relaxation — visual "cloudiness"
 * comes from the caller sorting by size (big → small) so rows taper.
 */

export interface PackedCircle {
  /** Center x (px, within [r, width - r]). */
  x: number;
  /** Center y (px, >= r). */
  y: number;
  r: number;
}

/** Gap between adjacent circles (px). */
const GAP = 4;

/**
 * Pack circles of the given radii into a column of the given width.
 * Deterministic: same input → same output. Radii <= 0 are clamped to 1.
 * Circles wider than `width` are clamped to fit.
 */
export function packCircles(radii: number[], width: number): PackedCircle[] {
  const w = Math.max(1, width);
  const out: PackedCircle[] = [];

  let cursorX = 0; // left edge of the next circle
  let rowTop = 0;
  let rowHeight = 0;

  for (const raw of radii) {
    let r = Math.max(1, raw);
    if (r * 2 > w) r = w / 2; // clamp oversized circles to the column
    const d = r * 2;

    if (cursorX > 0 && cursorX + d > w) {
      // Wrap to a new row.
      rowTop += rowHeight + GAP;
      rowHeight = 0;
      cursorX = 0;
    }

    out.push({ x: cursorX + r, y: rowTop + r, r });
    cursorX += d + GAP;
    rowHeight = Math.max(rowHeight, d);
  }

  return out;
}

/** Total height (px) needed to contain the packed circles. */
export function packedHeight(circles: PackedCircle[]): number {
  let max = 0;
  for (const c of circles) max = Math.max(max, c.y + c.r);
  return max;
}
