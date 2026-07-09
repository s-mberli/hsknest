import { describe, expect, it } from "vitest";
import { applyUserModifiers, type UserSRSPrefs } from "../modifiers";
import { SM2Algorithm } from "../sm2";
import { addDays, type SRSResult, type SRSState } from "../types";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

const algo = new SM2Algorithm();

function freshState(overrides: Partial<SRSState> = {}): SRSState {
  return { ...algo.initialState(NOW), ...overrides };
}

/** Build an SRSResult with a chosen post-algorithm interval/state. */
function resultWith(overrides: Partial<SRSState>): SRSResult {
  return {
    next: {
      ...freshState(),
      state: "REVIEW",
      lastReviewedAt: NOW,
      ...overrides,
    },
  };
}

const DEFAULT_PREFS: UserSRSPrefs = {
  intervalModifier: 1.0,
  lapseModifier: 0.0,
  masteryThresholdDays: null,
  fuzzIntervals: true,
};

function prefs(overrides: Partial<UserSRSPrefs> = {}): UserSRSPrefs {
  return { ...DEFAULT_PREFS, ...overrides };
}

function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / DAY_MS;
}

describe("applyUserModifiers — intervalModifier on success", () => {
  const cases: {
    intervalModifier: number;
    interval: number;
    expected: number;
  }[] = [
    { intervalModifier: 1.0, interval: 10, expected: 10 },
    { intervalModifier: 0.8, interval: 10, expected: 8 },
    { intervalModifier: 1.5, interval: 10, expected: 15 },
    { intervalModifier: 2.0, interval: 10, expected: 20 },
  ];

  it.each(cases)(
    "modifier $intervalModifier × interval $interval → $expected (no fuzz)",
    ({ intervalModifier, interval, expected }) => {
      const { next } = applyUserModifiers(
        freshState({ intervalDays: interval }),
        resultWith({ intervalDays: interval }),
        4,
        prefs({ intervalModifier, fuzzIntervals: false }),
        NOW
      );
      expect(next.intervalDays).toBe(expected);
      expect(daysBetween(next.dueAt, NOW)).toBe(expected);
    }
  );
});

describe("applyUserModifiers — lapse handling", () => {
  it("lapseModifier > 0 sets interval = prevInterval * modifier", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 40 }),
      resultWith({ intervalDays: 1, state: "LEARNING" }),
      1,
      prefs({ lapseModifier: 0.5, fuzzIntervals: false }),
      NOW
    );
    expect(next.intervalDays).toBe(20);
  });

  it("floors post-lapse interval at 1 day", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 1 }),
      resultWith({ intervalDays: 1, state: "LEARNING" }),
      0,
      prefs({ lapseModifier: 0.25, fuzzIntervals: false }),
      NOW
    );
    expect(next.intervalDays).toBe(1);
  });

  it("lapseModifier = 0 leaves the algorithm's lapse interval untouched", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 40 }),
      resultWith({ intervalDays: 1, state: "LEARNING" }),
      1,
      prefs({ lapseModifier: 0, fuzzIntervals: false }),
      NOW
    );
    expect(next.intervalDays).toBe(1);
  });
});

describe("applyUserModifiers — fuzz", () => {
  it("keeps fuzzed interval within ±5% for a seeded rng sweep", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999999]) {
      const { next } = applyUserModifiers(
        freshState({ intervalDays: 100 }),
        resultWith({ intervalDays: 100 }),
        4,
        prefs({ fuzzIntervals: true }),
        NOW,
        () => r
      );
      expect(next.intervalDays).toBeGreaterThanOrEqual(95);
      expect(next.intervalDays).toBeLessThanOrEqual(105);
    }
  });

  it("rng=0 → -5%, rng≈1 → +5%", () => {
    const low = applyUserModifiers(
      freshState({ intervalDays: 100 }),
      resultWith({ intervalDays: 100 }),
      4,
      prefs({ fuzzIntervals: true }),
      NOW,
      () => 0
    ).next.intervalDays;
    const high = applyUserModifiers(
      freshState({ intervalDays: 100 }),
      resultWith({ intervalDays: 100 }),
      4,
      prefs({ fuzzIntervals: true }),
      NOW,
      () => 1
    ).next.intervalDays;
    expect(low).toBeCloseTo(95, 5);
    expect(high).toBeCloseTo(105, 5);
  });

  it("does not fuzz intervals below 2 days", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 1 }),
      resultWith({ intervalDays: 1 }),
      4,
      prefs({ fuzzIntervals: true }),
      NOW,
      () => 0
    );
    expect(next.intervalDays).toBe(1);
  });
});

describe("applyUserModifiers — mastery transition", () => {
  it("promotes to MASTERED once interval reaches the threshold", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 200 }),
      resultWith({ intervalDays: 200 }),
      4,
      prefs({ masteryThresholdDays: 180, fuzzIntervals: false }),
      NOW
    );
    expect(next.state).toBe("MASTERED");
  });

  it("stays REVIEW when below threshold", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 100 }),
      resultWith({ intervalDays: 100 }),
      4,
      prefs({ masteryThresholdDays: 180, fuzzIntervals: false }),
      NOW
    );
    expect(next.state).toBe("REVIEW");
  });

  it("null threshold never masters", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 9999 }),
      resultWith({ intervalDays: 9999 }),
      4,
      prefs({ masteryThresholdDays: null, fuzzIntervals: false }),
      NOW
    );
    expect(next.state).toBe("REVIEW");
  });
});

describe("applyUserModifiers — defaults are identity (regression guard)", () => {
  it("does not alter the algorithm result under default prefs (fuzz off for determinism)", () => {
    const base = resultWith({ intervalDays: 15 });
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 6 }),
      base,
      4,
      prefs({ fuzzIntervals: false }),
      NOW
    );
    expect(next.intervalDays).toBe(15);
    expect(next.state).toBe("REVIEW");
    expect(next.dueAt.getTime()).toBe(addDays(NOW, 15).getTime());
  });

  it("purity: does not mutate prev or result inputs", () => {
    const prev = freshState({ intervalDays: 6 });
    const result = resultWith({ intervalDays: 15 });
    const prevSnap = JSON.stringify(prev);
    const resultSnap = JSON.stringify(result);
    applyUserModifiers(prev, result, 4, prefs({ intervalModifier: 2 }), NOW);
    expect(JSON.stringify(prev)).toBe(prevSnap);
    expect(JSON.stringify(result)).toBe(resultSnap);
  });
});

describe("applyUserModifiers — rounding after mutations", () => {
  it("rounds interval after intervalModifier multiplication", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 10 }),
      resultWith({ intervalDays: 10 }),
      4,
      prefs({ intervalModifier: 1.33, fuzzIntervals: false }),
      NOW
    );
    expect(next.intervalDays).toBe(13); // 10 * 1.33 = 13.3 → 13
    expect(Number.isInteger(next.intervalDays)).toBe(true);
  });

  it("rounds interval after fuzzing", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 100 }),
      resultWith({ intervalDays: 100 }),
      4,
      prefs({ fuzzIntervals: true }),
      NOW,
      () => 0.5 // Mid-range rng
    );
    expect(Number.isInteger(next.intervalDays)).toBe(true);
  });
});

describe("applyUserModifiers — interval cap", () => {
  it("caps interval at MAX_INTERVAL_DAYS (10950) after modifier", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 7000 }),
      resultWith({ intervalDays: 7000 }),
      4,
      prefs({ intervalModifier: 2.0, fuzzIntervals: false }),
      NOW
    );
    expect(next.intervalDays).toBe(10950);
    expect(next.intervalDays).toBeLessThanOrEqual(10950);
  });

  it("caps interval at MAX_INTERVAL_DAYS (10950) after fuzzing", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 10500 }),
      resultWith({ intervalDays: 10500 }),
      4,
      prefs({ fuzzIntervals: true }),
      NOW,
      () => 0.9 // Will push towards +5% which exceeds 10950
    );
    expect(next.intervalDays).toBeLessThanOrEqual(10950);
  });

  it("does not cap intervals below the max", () => {
    const { next } = applyUserModifiers(
      freshState({ intervalDays: 5000 }),
      resultWith({ intervalDays: 5000 }),
      4,
      prefs({ intervalModifier: 1.5, fuzzIntervals: false }),
      NOW
    );
    expect(next.intervalDays).toBe(7500); // 5000 * 1.5 = 7500, below cap
  });
});
