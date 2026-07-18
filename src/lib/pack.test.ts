import { describe, expect, it } from "vitest";
import { packCircles, packedHeight } from "./pack";

const EPS = 0.001;

function overlaps(
  a: { x: number; y: number; r: number },
  b: { x: number; y: number; r: number }
): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) + EPS < a.r + b.r;
}

describe("packCircles", () => {
  it("produces no overlapping circles", () => {
    const radii = [40, 35, 30, 30, 28, 25, 25, 22, 22, 22, 22, 22];
    const packed = packCircles(radii, 320);
    for (let i = 0; i < packed.length; i++) {
      for (let j = i + 1; j < packed.length; j++) {
        expect(overlaps(packed[i], packed[j])).toBe(false);
      }
    }
  });

  it("keeps every circle within the horizontal bounds", () => {
    const radii = [56, 40, 30, 22, 22, 22, 22, 22, 22, 22];
    const width = 300;
    const packed = packCircles(radii, width);
    for (const c of packed) {
      expect(c.x - c.r).toBeGreaterThanOrEqual(-EPS);
      expect(c.x + c.r).toBeLessThanOrEqual(width + EPS);
      expect(c.y - c.r).toBeGreaterThanOrEqual(-EPS);
    }
  });

  it("is deterministic for identical input", () => {
    const radii = [30, 25, 22, 40, 22, 35];
    expect(packCircles(radii, 280)).toEqual(packCircles(radii, 280));
  });

  it("preserves input order (one output per input radius)", () => {
    const radii = [40, 22, 30];
    const packed = packCircles(radii, 400);
    expect(packed.map((c) => c.r)).toEqual(radii);
  });

  it("clamps circles wider than the column instead of overflowing", () => {
    const packed = packCircles([500], 100);
    expect(packed[0].r).toBe(50);
    expect(packed[0].x + packed[0].r).toBeLessThanOrEqual(100 + EPS);
  });

  it("handles empty and degenerate radii", () => {
    expect(packCircles([], 300)).toEqual([]);
    const packed = packCircles([0, -5], 300);
    for (const c of packed) expect(c.r).toBeGreaterThan(0);
  });
});

describe("packedHeight", () => {
  it("is 0 for no circles and covers the lowest circle otherwise", () => {
    expect(packedHeight([])).toBe(0);
    const packed = packCircles([30, 30, 30, 30], 100);
    const h = packedHeight(packed);
    for (const c of packed) expect(c.y + c.r).toBeLessThanOrEqual(h + 0.001);
  });
});
