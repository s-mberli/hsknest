import { describe, expect, it } from "vitest";
import { SM2Algorithm } from "../sm2";
import type { ReviewQuality, SRSState } from "../types";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const algo = new SM2Algorithm();

function freshState(overrides: Partial<SRSState> = {}): SRSState {
  return {
    ...algo.initialState(NOW),
    ...overrides,
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY_MS);
}

describe("SM2Algorithm.initialState", () => {
  it("returns default NEW state", () => {
    const s = algo.initialState(NOW);
    expect(s.state).toBe("NEW");
    expect(s.easeFactor).toBe(2.5);
    expect(s.intervalDays).toBe(0);
    expect(s.repetitions).toBe(0);
    expect(s.lapses).toBe(0);
    expect(s.dueAt.getTime()).toBe(NOW.getTime());
    expect(s.lastReviewedAt).toBeNull();
  });
});

describe("SM2Algorithm.calculateNextReview — first review from NEW", () => {
  // EF update: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02)), floor 1.3
  const cases: {
    quality: ReviewQuality;
    expectedInterval: number;
    expectedReps: number;
    expectedEase: number;
    expectedState: SRSState["state"];
    expectedLapses: number;
  }[] = [
    { quality: 0, expectedInterval: 1, expectedReps: 0, expectedEase: 1.7, expectedState: "LEARNING", expectedLapses: 1 },
    { quality: 1, expectedInterval: 1, expectedReps: 0, expectedEase: 1.96, expectedState: "LEARNING", expectedLapses: 1 },
    { quality: 2, expectedInterval: 1, expectedReps: 0, expectedEase: 2.18, expectedState: "LEARNING", expectedLapses: 1 },
    { quality: 3, expectedInterval: 1, expectedReps: 1, expectedEase: 2.36, expectedState: "REVIEW", expectedLapses: 0 },
    { quality: 4, expectedInterval: 1, expectedReps: 1, expectedEase: 2.5, expectedState: "REVIEW", expectedLapses: 0 },
    { quality: 5, expectedInterval: 1, expectedReps: 1, expectedEase: 2.6, expectedState: "REVIEW", expectedLapses: 0 },
  ];

  it.each(cases)(
    "quality $quality → interval $expectedInterval, reps $expectedReps, ease $expectedEase",
    ({ quality, expectedInterval, expectedReps, expectedEase, expectedState, expectedLapses }) => {
      const { next } = algo.calculateNextReview(freshState(), quality, NOW);
      expect(next.intervalDays).toBe(expectedInterval);
      expect(next.repetitions).toBe(expectedReps);
      expect(next.easeFactor).toBeCloseTo(expectedEase, 5);
      expect(next.state).toBe(expectedState);
      expect(next.lapses).toBe(expectedLapses);
      expect(daysBetween(next.dueAt, NOW)).toBe(expectedInterval);
      expect(next.lastReviewedAt?.getTime()).toBe(NOW.getTime());
    }
  );
});

describe("SM2Algorithm interval progression on repeated success", () => {
  it("reps 1 → interval 6", () => {
    const state = freshState({ repetitions: 1, intervalDays: 1, easeFactor: 2.5, state: "REVIEW" });
    const { next } = algo.calculateNextReview(state, 4, NOW);
    expect(next.intervalDays).toBe(6);
    expect(next.repetitions).toBe(2);
  });

  it("reps >=2 → round(prevInterval * easeFactor)", () => {
    const state = freshState({ repetitions: 2, intervalDays: 6, easeFactor: 2.5, state: "REVIEW" });
    const { next } = algo.calculateNextReview(state, 4, NOW);
    // EF stays 2.5 at q=4; 6 * 2.5 = 15
    expect(next.intervalDays).toBe(15);
    expect(next.repetitions).toBe(3);
  });

  it("ease factor never drops below 1.3", () => {
    const state = freshState({ easeFactor: 1.3 });
    const { next } = algo.calculateNextReview(state, 0, NOW);
    expect(next.easeFactor).toBe(1.3);
  });
});

describe("SM2Algorithm failure resets repetitions and counts a lapse", () => {
  it("quality < 3 after successes → reps 0, interval 1, lapse++", () => {
    const state = freshState({ repetitions: 5, intervalDays: 60, lapses: 2, state: "REVIEW" });
    const { next } = algo.calculateNextReview(state, 1, NOW);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.lapses).toBe(3);
    expect(next.state).toBe("LEARNING");
  });
});

describe("SM2Algorithm purity", () => {
  it("does not mutate the input state", () => {
    const state = freshState({ repetitions: 2, intervalDays: 6 });
    const snapshot = JSON.stringify(state);
    algo.calculateNextReview(state, 5, NOW);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
