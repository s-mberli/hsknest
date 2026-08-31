import { describe, expect, it } from "vitest";

import type { PracticeModeKey } from "@/lib/practiceModes";
import { selectPracticeMode } from "@/lib/practiceRotation";

/** Deterministic rng over a fixed sequence, cycling if drained. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Small LCG — a fixed-seed stand-in for Math.random. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const ALL: PracticeModeKey[] = ["quiz", "match", "pronounce", "sentences"];

describe("selectPracticeMode", () => {
  it("returns nothing when no mode is available", () => {
    expect(selectPracticeMode([], null, seq([0]))).toBeNull();
    expect(selectPracticeMode([], "quiz", seq([0.99]))).toBeNull();
  });

  it("returns the only available mode even when it was the previous one", () => {
    expect(selectPracticeMode(["quiz"], "quiz", seq([0]))).toBe("quiz");
    expect(selectPracticeMode(["match"], "match", seq([0.99]))).toBe("match");
  });

  it("never returns the previous mode when an alternative exists", () => {
    for (const previous of ALL) {
      for (let r = 0; r < 1; r += 0.01) {
        expect(selectPracticeMode(ALL, previous, seq([r]))).not.toBe(previous);
      }
    }
    // Two-mode case: the alternative is forced regardless of the draw.
    expect(selectPracticeMode(["quiz", "match"], "quiz", seq([0]))).toBe("match");
    expect(selectPracticeMode(["quiz", "match"], "quiz", seq([0.99]))).toBe("match");
  });

  it("selects every available mode eventually over a fixed seed sequence", () => {
    const rng = lcg(42);
    const seen = new Set<PracticeModeKey>();
    let previous: PracticeModeKey | null = null;
    for (let i = 0; i < 200; i++) {
      const next = selectPracticeMode(ALL, previous, rng);
      expect(next).not.toBeNull();
      seen.add(next as PracticeModeKey);
      previous = next;
    }
    expect([...seen].sort()).toEqual([...ALL].sort());
  });

  it("never selects a mode outside the available list", () => {
    const rng = lcg(7);
    const available: PracticeModeKey[] = ["quiz", "sentences"];
    let previous: PracticeModeKey | null = null;
    for (let i = 0; i < 100; i++) {
      const next = selectPracticeMode(available, previous, rng);
      expect(available).toContain(next);
      previous = next;
    }
  });

  it("falls back to the full list when the previous mode is no longer available", () => {
    const next = selectPracticeMode(["quiz", "match"], "sentences", seq([0]));
    expect(next).toBe("quiz");
  });

  it("clamps an rng that returns 1", () => {
    expect(selectPracticeMode(ALL, null, seq([1]))).toBe("sentences");
  });
});
