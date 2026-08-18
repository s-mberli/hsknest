import { describe, it, expect } from "vitest";
import { laneLayout, clampTileX } from "@/lib/ninja/layout";

describe("ninjaLayout", () => {
  describe("laneLayout", () => {
    it("computes tile size from width (clamp 44–72px, 8vw)", () => {
      // 300px width: 8vw = 24px → clamped to 44px
      let result = laneLayout({ width: 300, height: 600, bottom: 600 }, 4);
      expect(result.tileSizePx).toBe(44);

      // 600px width: 8vw = 48px → within bounds
      result = laneLayout({ width: 600, height: 600, bottom: 600 }, 4);
      expect(result.tileSizePx).toBeCloseTo(48, 0);

      // 1280px width: 8vw = 102px → clamped to 72px
      result = laneLayout({ width: 1280, height: 600, bottom: 600 }, 4);
      expect(result.tileSizePx).toBe(72);
    });

    it("reduces lane count on narrow viewports to prevent overlap", () => {
      // 300px width with 4 lanes: lane width = 75px
      // tile circle ≈ 44 * 1.8 ≈ 79.2px, need 79.2*1.35 ≈ 107px per lane
      // 75 < 107 → drop to 3 lanes
      let result = laneLayout({ width: 300, height: 600, bottom: 600 }, 4);
      expect(result.laneCount).toBe(3);

      // 900px width: lane width = 225px, circle ≈ 86.4px, need ≈ 117px
      // 225 > 117 → keep 4 lanes
      result = laneLayout({ width: 900, height: 600, bottom: 600 }, 4);
      expect(result.laneCount).toBe(4);
    });

    it("drops to 3 lanes on a real phone viewport (390px) — the exact size the fallback exists for", () => {
      // 390px width, 4 lanes: lane width = 97.5px. Tile size clamps to 44px
      // (8vw of 390 = 31.2, floored to min), circle = 79.2px, needs
      // 79.2*1.35 ≈ 106.9px per lane. 97.5 < 106.9 → drop to 3 lanes.
      // Previously the 1.15 threshold needed only 91.1px, so 4 lanes stayed
      // on the exact viewport most likely to overlap — the regression this
      // covers.
      const result = laneLayout({ width: 390, height: 700, bottom: 700 }, 4);
      expect(result.laneCount).toBe(3);
    });

    it("clamps lane centres to prevent off-screen tiles", () => {
      // 375px width, 4 lanes, tile size ≈ 44px → circle ≈ 79px, radius ≈ 51px
      const result = laneLayout({ width: 375, height: 600, bottom: 600 }, 4);

      // All lane centres must be at least (radius + margin) from edges
      for (const centre of result.laneCentres) {
        expect(centre).toBeGreaterThanOrEqual(result.tileRadiusPx + 10);
        expect(centre).toBeLessThanOrEqual(375 - result.tileRadiusPx - 10);
      }
    });

    it("produces correct number of lane centres matching laneCount", () => {
      const result = laneLayout({ width: 600, height: 600, bottom: 600 }, 4);
      expect(result.laneCentres.length).toBe(result.laneCount);
    });

    it("handles 320px mobile viewport", () => {
      const result = laneLayout({ width: 320, height: 600, bottom: 600 }, 4);

      // Verify no two lanes are closer than their tile diameter apart
      for (let i = 0; i < result.laneCentres.length - 1; i++) {
        const dist = result.laneCentres[i + 1] - result.laneCentres[i];
        expect(dist).toBeGreaterThanOrEqual(result.targetCircleDiameterPx);
      }
    });

    it("handles 1280px desktop viewport", () => {
      const result = laneLayout({ width: 1280, height: 600, bottom: 600 }, 4);
      expect(result.laneCount).toBe(4);

      for (const centre of result.laneCentres) {
        expect(centre).toBeGreaterThanOrEqual(result.tileRadiusPx + 10);
        expect(centre).toBeLessThanOrEqual(1280 - result.tileRadiusPx - 10);
      }
    });
  });

  describe("clampTileX", () => {
    it("prevents tile from leaving left edge", () => {
      const clamped = clampTileX(0, 50, 400);
      expect(clamped).toBeGreaterThanOrEqual(50 + 10);
    });

    it("prevents tile from leaving right edge", () => {
      const clamped = clampTileX(400, 50, 400);
      expect(clamped).toBeLessThanOrEqual(400 - 50 - 10);
    });

    it("keeps tile in bounds when already clamped", () => {
      const clamped = clampTileX(200, 50, 400);
      expect(clamped).toBe(200);
    });
  });
});
