import { describe, expect, it } from "vitest";

import type { PracticeModeKey } from "@/lib/practiceModes";
import { advanceRound, startRotation } from "@/lib/practiceRotation";

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

describe("startRotation", () => {
  it("opens on round 1 with a mode and no previous", () => {
    const state = startRotation(ALL, seq([0]));
    expect(state.current).toBe("quiz");
    expect(state.previous).toBeNull();
    expect(state.round).toBe(1);
  });

  it("yields no mode when nothing is available", () => {
    const state = startRotation([], seq([0]));
    expect(state.current).toBeNull();
    expect(state.round).toBe(1);
  });
});

describe("advanceRound", () => {
  it("continues into another round rather than ending the session", () => {
    const first = startRotation(ALL, seq([0]));
    const second = advanceRound(first, ALL, seq([0]));

    expect(second.round).toBe(2);
    expect(second.current).not.toBeNull();
  });

  it("hands off to a different mode when more than one is available", () => {
    let state = startRotation(ALL, lcg(42));
    const rng = lcg(99);
    for (let i = 0; i < 50; i++) {
      const next = advanceRound(state, ALL, rng);
      expect(next.current).not.toBe(state.current);
      expect(next.previous).toBe(state.current);
      state = next;
    }
  });

  it("replays the only available mode with no dead end", () => {
    const only: PracticeModeKey[] = ["match"];
    let state = startRotation(only, seq([0]));
    expect(state.current).toBe("match");

    for (let i = 0; i < 5; i++) {
      state = advanceRound(state, only, seq([0.99]));
      expect(state.current).toBe("match");
    }
    expect(state.round).toBe(6);
  });

  it("every round is drawn from the available list", () => {
    const available: PracticeModeKey[] = ["quiz", "sentences"];
    const rng = lcg(7);
    let state = startRotation(available, rng);
    for (let i = 0; i < 100; i++) {
      state = advanceRound(state, available, rng);
      expect(available).toContain(state.current);
    }
  });

  it("the announced next mode is the mode actually played after advancing", () => {
    // `state.next` is what the UI shows as "Next round · X" before the user
    // clicks. It must be a decided fact, not a value re-drawn at render time —
    // otherwise the label can promise a mode the click doesn't deliver.
    let state = startRotation(ALL, lcg(13));
    const rng = lcg(31);
    for (let i = 0; i < 50; i++) {
      const announced = state.next;
      state = advanceRound(state, ALL, rng);
      expect(state.current).toBe(announced);
    }
  });
});
