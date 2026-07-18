import { describe, expect, it } from "vitest";
import { retentionCurve, retentionNow } from "./retention";

const NOW = new Date("2026-01-01T00:00:00.000Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

function iso(offsetDays: number): string {
  return new Date(NOW + offsetDays * DAY_MS).toISOString();
}

describe("retentionCurve", () => {
  it("starts at 1 (t=0) and decays monotonically to the interval endpoint", () => {
    const curve = retentionCurve({ intervalDays: 10, easeFactor: 2.5 }, 5);
    expect(curve).toHaveLength(5);
    expect(curve[0]).toBeCloseTo(1, 5);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeLessThanOrEqual(curve[i - 1]);
    }
    curve.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it("higher ease factor produces a flatter (slower-decaying) curve", () => {
    const low = retentionCurve({ intervalDays: 10, easeFactor: 1.3 }, 5);
    const high = retentionCurve({ intervalDays: 10, easeFactor: 2.8 }, 5);
    // At the same mid-point, higher ease should retain more.
    expect(high[2]).toBeGreaterThan(low[2]);
  });

  it("handles missing/zero/negative intervalDays with a flat low curve, not a crash", () => {
    expect(retentionCurve({ intervalDays: null, easeFactor: 2.5 }, 4)).toEqual([
      0.5, 0.5, 0.5, 0.5,
    ]);
    expect(retentionCurve({ intervalDays: 0, easeFactor: 2.5 }, 3)).toEqual([
      0.5, 0.5, 0.5,
    ]);
    expect(retentionCurve({ intervalDays: -5, easeFactor: 2.5 }, 3)).toEqual([
      0.5, 0.5, 0.5,
    ]);
  });

  it("clamps points to a minimum of 2 samples", () => {
    expect(retentionCurve({ intervalDays: 10, easeFactor: 2.5 }, 0)).toHaveLength(2);
    expect(retentionCurve({ intervalDays: 10, easeFactor: 2.5 }, 1)).toHaveLength(2);
  });

  it("defaults ease factor when null (uses DEFAULT_EASE baseline)", () => {
    const withNull = retentionCurve({ intervalDays: 10, easeFactor: null }, 5);
    const withDefault = retentionCurve({ intervalDays: 10, easeFactor: 2.5 }, 5);
    expect(withNull).toEqual(withDefault);
  });
});

describe("retentionNow", () => {
  it("returns a value near 1 right after being reviewed (far from due)", () => {
    // intervalDays=10, dueAt 10 days out -> "just reviewed" at NOW.
    const r = retentionNow(
      { intervalDays: 10, easeFactor: 2.5, dueAt: iso(10) },
      NOW
    );
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(1, 5);
  });

  it("decays as the due date approaches", () => {
    // dueAt in the past relative to when it was scheduled: elapsed > 0.
    const r = retentionNow(
      { intervalDays: 10, easeFactor: 2.5, dueAt: iso(0) },
      NOW
    );
    expect(r).not.toBeNull();
    expect(r!).toBeLessThan(1);
    expect(r!).toBeGreaterThan(0);
  });

  it("returns null when intervalDays or dueAt is missing/invalid", () => {
    expect(
      retentionNow({ intervalDays: null, easeFactor: 2.5, dueAt: iso(1) }, NOW)
    ).toBeNull();
    expect(
      retentionNow({ intervalDays: 10, easeFactor: 2.5, dueAt: null }, NOW)
    ).toBeNull();
    expect(
      retentionNow(
        { intervalDays: 10, easeFactor: 2.5, dueAt: "not-a-date" },
        NOW
      )
    ).toBeNull();
    expect(
      retentionNow({ intervalDays: 0, easeFactor: 2.5, dueAt: iso(1) }, NOW)
    ).toBeNull();
  });
});
