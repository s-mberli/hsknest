import { describe, it, expect } from "vitest";
import {
  pointSegmentDistanceSq,
  segmentCircleHit,
  pointerSpeedPx_s,
} from "@/lib/ninja/geometry";

describe("ninjaGeometry", () => {
  describe("pointSegmentDistanceSq", () => {
    it("measures distance from point to closest point on segment", () => {
      // Point (5, 5) to segment (0, 0)-(10, 0) should be 5² = 25
      expect(pointSegmentDistanceSq(5, 5, 0, 0, 10, 0)).toBe(25);
    });

    it("returns squared distance at segment endpoint", () => {
      // Point (10, 0) is on endpoint of segment (0, 0)-(10, 0)
      expect(pointSegmentDistanceSq(10, 0, 0, 0, 10, 0)).toBe(0);
    });

    it("clamps projection to segment bounds (not extended line)", () => {
      // Point (11, 5) to segment (0, 0)-(10, 0) should measure to endpoint (10, 0)
      // Distance = sqrt((11-10)² + (5-0)²) = sqrt(1 + 25) = sqrt(26) ≈ 5.1, squared ≈ 26
      expect(pointSegmentDistanceSq(11, 5, 0, 0, 10, 0)).toBeCloseTo(26, 1);
    });

    it("handles zero-length segment (point coincident with both endpoints)", () => {
      // Segment from (5, 5) to (5, 5) — should measure to (5, 5)
      expect(pointSegmentDistanceSq(5, 5, 5, 5, 5, 5)).toBe(0);
      expect(pointSegmentDistanceSq(10, 10, 5, 5, 5, 5)).toBeCloseTo(50, 1);
    });
  });

  describe("segmentCircleHit", () => {
    it("detects intersection: segment crosses circle", () => {
      // Segment (0, 0)-(10, 0) with circle at (5, 0) radius 5
      // Segment passes through circle center — definitely hits
      expect(segmentCircleHit(0, 0, 10, 0, 5, 0, 5)).toBe(true);
    });

    it("detects near-miss: segment close but outside circle", () => {
      // Segment (0, 0)-(10, 0) with circle at (5, 10) radius 5
      // Closest distance to circle = 10, radius = 5 → no hit
      expect(segmentCircleHit(0, 0, 10, 0, 5, 10, 5)).toBe(false);
    });

    it("detects tangent touch", () => {
      // Segment (0, 0)-(10, 0) with circle at (5, 5) radius 5
      // Closest point on segment to circle is (5, 0), distance = 5 → hit (tangent)
      expect(segmentCircleHit(0, 0, 10, 0, 5, 5, 5)).toBe(true);
    });

    it("handles segment endpoint inside circle", () => {
      // Segment (0, 0)-(2, 0) with circle at (5, 0) radius 10
      // Both endpoints inside circle → hit
      expect(segmentCircleHit(0, 0, 2, 0, 5, 0, 10)).toBe(true);
    });
  });

  describe("pointerSpeedPx_s", () => {
    it("calculates speed from distance and time", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 0 };
      const speed = pointerSpeedPx_s(p1, p2, 1); // 100px in 1s = 100px/s
      expect(speed).toBe(100);
    });

    it("handles diagonal movement", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      const speed = pointerSpeedPx_s(p1, p2, 1); // sqrt(9 + 16) = 5px in 1s
      expect(speed).toBe(5);
    });

    it("returns 0 for zero or negative dt", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 0 };
      expect(pointerSpeedPx_s(p1, p2, 0)).toBe(0);
      expect(pointerSpeedPx_s(p1, p2, -1)).toBe(0);
    });

    it("scales with fractional dt", () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 0 };
      const speed = pointerSpeedPx_s(p1, p2, 0.5); // 100px in 0.5s = 200px/s
      expect(speed).toBe(200);
    });
  });
});
