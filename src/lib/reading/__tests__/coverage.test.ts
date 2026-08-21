import { describe, expect, it } from "vitest";
import {
  computeCoverage,
  toKnownTermKeys,
  fitLabel,
  pickBestFit,
  IDEAL_COVERAGE_MIN,
  IDEAL_COVERAGE_MAX,
} from "../coverage";

describe("computeCoverage", () => {
  it("returns null pct for a text with no indexed words", () => {
    const r = computeCoverage([], new Set());
    expect(r.pct).toBeNull();
    expect(r.totalCount).toBe(0);
  });

  it("computes the fraction of known lemmas", () => {
    const known = toKnownTermKeys(["你好", "谢谢"]);
    const r = computeCoverage(["你好", "谢谢", "再见", "苹果"], known);
    expect(r.knownCount).toBe(2);
    expect(r.totalCount).toBe(4);
    expect(r.pct).toBe(0.5);
  });

  it("is 1.0 when every lemma is known", () => {
    const known = toKnownTermKeys(["你好", "谢谢"]);
    const r = computeCoverage(["你好", "谢谢"], known);
    expect(r.pct).toBe(1);
  });

  it("is 0 when nothing is known", () => {
    const known = toKnownTermKeys([]);
    const r = computeCoverage(["你好"], known);
    expect(r.pct).toBe(0);
  });

  it("normalizes terms via termKey before matching (whitespace/NFC)", () => {
    const known = toKnownTermKeys([" 你好 "]); // stray whitespace
    const r = computeCoverage(["你好"], known);
    expect(r.knownCount).toBe(1);
  });
});

describe("fitLabel", () => {
  it("labels near-total coverage as too-easy", () => {
    expect(fitLabel(0.995)).toBe("too-easy");
  });

  it("labels the ideal band as just-right", () => {
    expect(fitLabel(IDEAL_COVERAGE_MIN)).toBe("just-right");
    expect(fitLabel(IDEAL_COVERAGE_MAX)).toBe("just-right");
    expect(fitLabel(0.95)).toBe("just-right");
  });

  it("labels below-band-but-plausible as challenging", () => {
    expect(fitLabel(0.8)).toBe("challenging");
  });

  it("labels low coverage as too-hard", () => {
    expect(fitLabel(0.5)).toBe("too-hard");
  });
});

describe("pickBestFit", () => {
  it("returns null for an empty pool", () => {
    expect(pickBestFit([])).toBeNull();
  });

  it("returns null when every candidate has a null pct", () => {
    expect(pickBestFit([{ id: "a", pct: null }, { id: "b", pct: null }])).toBeNull();
  });

  it("picks the candidate inside the ideal band over ones outside it", () => {
    const best = pickBestFit([
      { id: "too-easy", pct: 1.0 },
      { id: "ideal", pct: 0.94 },
      { id: "too-hard", pct: 0.5 },
    ]);
    expect(best?.id).toBe("ideal");
  });

  it("when nothing is in-band, picks whichever is closest to the band", () => {
    const best = pickBestFit([
      { id: "close-above", pct: 0.99 },
      { id: "far-below", pct: 0.3 },
    ]);
    expect(best?.id).toBe("close-above");
  });

  it("ignores null-pct candidates when scoring the pool", () => {
    const best = pickBestFit([
      { id: "no-data", pct: null },
      { id: "ideal", pct: 0.95 },
    ]);
    expect(best?.id).toBe("ideal");
  });
});
