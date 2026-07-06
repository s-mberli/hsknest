import { describe, expect, it } from "vitest";
import { BOX_INTERVALS, LeitnerSystem } from "../leitner";
import type { ReviewQuality, SRSState } from "../types";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const algo = new LeitnerSystem();

function stateInBox(box: number, overrides: Partial<SRSState> = {}): SRSState {
  return {
    ...algo.initialState(NOW),
    box,
    ...overrides,
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

describe("LeitnerSystem.initialState", () => {
  it("starts in box 1, due now", () => {
    const s = algo.initialState(NOW);
    expect(s.box).toBe(1);
    expect(s.state).toBe("NEW");
    expect(s.dueAt.getTime()).toBe(NOW.getTime());
    expect(s.lastReviewedAt).toBeNull();
  });
});

describe("LeitnerSystem quality 0-5 from box 1", () => {
  const cases: {
    quality: ReviewQuality;
    expectedBox: number;
    expectedInterval: number;
    expectedState: SRSState["state"];
    expectedLapses: number;
  }[] = [
    { quality: 0, expectedBox: 1, expectedInterval: 1, expectedState: "LEARNING", expectedLapses: 1 },
    { quality: 1, expectedBox: 1, expectedInterval: 1, expectedState: "LEARNING", expectedLapses: 1 },
    { quality: 2, expectedBox: 1, expectedInterval: 1, expectedState: "LEARNING", expectedLapses: 1 },
    { quality: 3, expectedBox: 2, expectedInterval: 2, expectedState: "REVIEW", expectedLapses: 0 },
    { quality: 4, expectedBox: 2, expectedInterval: 2, expectedState: "REVIEW", expectedLapses: 0 },
    { quality: 5, expectedBox: 2, expectedInterval: 2, expectedState: "REVIEW", expectedLapses: 0 },
  ];

  it.each(cases)(
    "quality $quality → box $expectedBox, interval $expectedInterval",
    ({ quality, expectedBox, expectedInterval, expectedState, expectedLapses }) => {
      const { next } = algo.calculateNextReview(stateInBox(1), quality, NOW);
      expect(next.box).toBe(expectedBox);
      expect(next.intervalDays).toBe(expectedInterval);
      expect(next.state).toBe(expectedState);
      expect(next.lapses).toBe(expectedLapses);
      expect(daysBetween(next.dueAt, NOW)).toBe(expectedInterval);
      expect(next.lastReviewedAt?.getTime()).toBe(NOW.getTime());
    }
  );
});

describe("LeitnerSystem promotion is capped at box 5", () => {
  it("box 5 + correct stays box 5 with interval 16", () => {
    const { next } = algo.calculateNextReview(stateInBox(5), 4, NOW);
    expect(next.box).toBe(5);
    expect(next.intervalDays).toBe(16);
    expect(BOX_INTERVALS[next.box - 1]).toBe(16);
  });

  it("promotes one box per success", () => {
    let s = stateInBox(1);
    const expectedBoxes = [2, 3, 4, 5, 5];
    for (const expected of expectedBoxes) {
      s = algo.calculateNextReview(s, 5, NOW).next;
      expect(s.box).toBe(expected);
    }
  });
});

describe("LeitnerSystem failure resets to box 1 and counts a lapse", () => {
  it("box 4 + wrong → box 1, lapse++", () => {
    const { next } = algo.calculateNextReview(stateInBox(4, { lapses: 1 }), 1, NOW);
    expect(next.box).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.lapses).toBe(2);
    expect(next.state).toBe("LEARNING");
  });
});

describe("LeitnerSystem carries SM-2 fields untouched", () => {
  it("preserves easeFactor and repetitions for algorithm-switch safety", () => {
    const s = stateInBox(2, { easeFactor: 1.9, repetitions: 4 });
    const { next } = algo.calculateNextReview(s, 4, NOW);
    expect(next.easeFactor).toBe(1.9);
    expect(next.repetitions).toBe(4);
  });

  it("does not mutate input", () => {
    const s = stateInBox(3);
    const snapshot = JSON.stringify(s);
    algo.calculateNextReview(s, 0, NOW);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
