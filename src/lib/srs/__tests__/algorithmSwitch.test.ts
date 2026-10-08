import { describe, expect, it } from "vitest";
import { applyUserModifiers, BOX_INTERVALS, getAlgorithm } from "@/lib/srs";
import { hydrateStateForAlgorithm } from "@/lib/srs/algorithmState";
import type { SRSAlgorithmType, SRSState } from "@/lib/srs/types";

const NOW = new Date("2025-08-29");

/** Review repeatedly at quality 4 until the interval reaches the target. */
function buildHistory(
  algorithm: SRSAlgorithmType,
  targetIntervalDays: number,
  startDate: Date
): SRSState {
  const algo = getAlgorithm(algorithm);
  let state = algo.initialState(startDate);
  let now = new Date(startDate);

  let iterations = 0;
  while (state.intervalDays < targetIntervalDays && iterations < 20) {
    state = algo.calculateNextReview(state, 4, now).next;
    now = new Date(state.dueAt);
    iterations++;
  }
  return state;
}

/** What the accumulated history justifies, capped by the destination's ceiling. */
function minimumPreservedInterval(
  state: SRSState,
  destAlgo: SRSAlgorithmType
): number {
  let sourceInterval = state.intervalDays;
  if (state.box > 1 && state.box <= BOX_INTERVALS.length) {
    sourceInterval = BOX_INTERVALS[state.box - 1];
  }
  if (destAlgo === "LEITNER") {
    return Math.min(sourceInterval, BOX_INTERVALS[BOX_INTERVALS.length - 1]);
  }
  return Math.max(sourceInterval, 1);
}

function assertSwitchPreservesInterval(
  sourceAlgo: SRSAlgorithmType,
  destAlgo: SRSAlgorithmType
) {
  const sourceState = buildHistory(sourceAlgo, 30, NOW);
  const destinationState = hydrateStateForAlgorithm(sourceState, destAlgo);
  const minInterval = minimumPreservedInterval(sourceState, destAlgo);

  const { next } = getAlgorithm(destAlgo).calculateNextReview(
    destinationState,
    4,
    NOW
  );

  expect(next.intervalDays).toBeGreaterThanOrEqual(minInterval);
  expect(next.intervalDays).toBeGreaterThan(0);
  expect(Number.isFinite(next.intervalDays)).toBe(true);
  expect(next.dueAt > NOW).toBe(true);
}

describe("Algorithm switching — interval preservation", () => {
  it.each<[SRSAlgorithmType, SRSAlgorithmType]>([
    ["SM2", "FSRS"],
    ["LEITNER", "FSRS"],
    ["FSRS", "SM2"],
    ["SM2", "LEITNER"],
    ["FSRS", "LEITNER"],
    ["LEITNER", "SM2"],
  ])("switching %s → %s preserves a mature interval", (from, to) => {
    assertSwitchPreservesInterval(from, to);
  });

  it("caps an SM-2 interval at Leitner's 16-day ceiling instead of restarting at 2 days", () => {
    const sm2 = getAlgorithm("SM2");
    let state = sm2.initialState(NOW);
    let now = new Date(NOW);

    for (let i = 0; i < 10; i++) {
      state = sm2.calculateNextReview(state, 5, now).next;
      now = new Date(state.dueAt);
    }
    expect(state.intervalDays).toBeGreaterThan(100);

    const readyForLeitner = hydrateStateForAlgorithm(state, "LEITNER");
    const { next } = getAlgorithm("LEITNER").calculateNextReview(
      readyForLeitner,
      4,
      NOW
    );
    expect(readyForLeitner.box).toBe(5);
    expect(next.intervalDays).toBe(16);
  });

  it("rebuilds a stale Leitner box when switching back after another algorithm grew the interval", () => {
    const matureSm2 = buildHistory("SM2", 30, NOW);
    const returnedToLeitner = hydrateStateForAlgorithm(
      {
        ...matureSm2,
        box: 2, // leftover from an earlier Leitner schedule
        srsData: { algorithm: "SM2" },
      },
      "LEITNER"
    );

    expect(returnedToLeitner.box).toBe(5);
    expect(
      getAlgorithm("LEITNER").calculateNextReview(returnedToLeitner, 4, NOW)
        .next.intervalDays
    ).toBe(16);
  });

  it("rebuilds stale SM-2 repetitions when switching back after Leitner matured the card", () => {
    const matureLeitner = buildHistory("LEITNER", 16, NOW);
    const returnedToSm2 = hydrateStateForAlgorithm(
      {
        ...matureLeitner,
        repetitions: 1, // leftover from an earlier SM-2 schedule
        srsData: { algorithm: "LEITNER" },
      },
      "SM2"
    );

    expect(returnedToSm2.repetitions).toBe(2);
    expect(
      getAlgorithm("SM2").calculateNextReview(returnedToSm2, 4, NOW)
        .next.intervalDays
    ).toBeGreaterThanOrEqual(16);
  });

  it("drops stale FSRS parameters when a marked foreign schedule is restored", () => {
    const foreign = {
      ...buildHistory("SM2", 30, NOW),
      srsData: { algorithm: "SM2", fsrs: { v: 1, s: 1, d: 10 } },
    };
    const returnedToFsrs = hydrateStateForAlgorithm(foreign, "FSRS");

    expect(returnedToFsrs.srsData).toEqual({ algorithm: "SM2" });
    const { next } = getAlgorithm("FSRS").calculateNextReview(
      returnedToFsrs,
      4,
      NOW
    );
    expect(next.intervalDays).toBeGreaterThan(1);
  });

  it("maps a short foreign REVIEW interval to SM-2's first success despite stale repetitions", () => {
    const returnedToSm2 = hydrateStateForAlgorithm(
      {
        ...buildHistory("LEITNER", 16, NOW),
        intervalDays: 1,
        repetitions: 8,
        srsData: { algorithm: "LEITNER" },
      },
      "SM2"
    );

    expect(returnedToSm2.repetitions).toBe(1);
    expect(
      getAlgorithm("SM2").calculateNextReview(returnedToSm2, 4, NOW)
        .next.intervalDays
    ).toBe(6);
  });

  it("maps a short foreign REVIEW interval to Leitner box 1 despite a stale mature box", () => {
    const returnedToLeitner = hydrateStateForAlgorithm(
      {
        ...buildHistory("SM2", 30, NOW),
        intervalDays: 1,
        box: 5,
        srsData: { algorithm: "SM2" },
      },
      "LEITNER"
    );

    expect(returnedToLeitner.box).toBe(1);
    expect(
      getAlgorithm("LEITNER").calculateNextReview(returnedToLeitner, 4, NOW)
        .next.intervalDays
    ).toBe(2);
  });

  it("rebuilds default target markers for mature MASTERED rows written by an assumed check", () => {
    const masteredSm2 = {
      ...getAlgorithm("SM2").initialState(NOW),
      state: "MASTERED" as const,
      intervalDays: 16,
      repetitions: 1,
      srsData: { algorithm: "SM2" },
    };
    const masteredLeitner = {
      ...getAlgorithm("LEITNER").initialState(NOW),
      state: "MASTERED" as const,
      intervalDays: 16,
      srsData: { algorithm: "LEITNER" },
    };

    expect(hydrateStateForAlgorithm(masteredSm2, "SM2").repetitions).toBe(2);
    expect(hydrateStateForAlgorithm(masteredLeitner, "LEITNER").box).toBe(5);
  });

  it.each([true, false])(
    "switching back to Leitner after an SM-2 lapse resets a stale box (marker=%s)",
    (withMarker) => {
      const matureLeitner = buildHistory("LEITNER", 16, NOW);
      const foreignState = {
        ...matureLeitner,
        srsData: withMarker ? { algorithm: "LEITNER" } : undefined,
      };
      const underSm2 = hydrateStateForAlgorithm(foreignState, "SM2");
      const lapsed = getAlgorithm("SM2").calculateNextReview(underSm2, 1, NOW).next;
      const afterPersistence = {
        ...lapsed,
        srsData: withMarker ? { algorithm: "SM2" } : undefined,
      };

      expect(afterPersistence.state).toBe("LEARNING");
      expect(afterPersistence.box).toBe(matureLeitner.box);
      const backUnderLeitner = hydrateStateForAlgorithm(
        afterPersistence,
        "LEITNER"
      );
      expect(backUnderLeitner.box).toBe(1);

      const { next } = getAlgorithm("LEITNER").calculateNextReview(
        backUnderLeitner,
        4,
        NOW
      );
      expect(next.intervalDays).toBe(2);
    }
  );

  it.each([true, false])(
    "switching back to SM-2 after a Leitner lapse resets stale repetitions (marker=%s)",
    (withMarker) => {
      const matureSm2 = {
        ...buildHistory("SM2", 30, NOW),
        repetitions: 8,
        srsData: withMarker ? { algorithm: "SM2" } : undefined,
      };
      const underLeitner = hydrateStateForAlgorithm(matureSm2, "LEITNER");
      const lapsed = getAlgorithm("LEITNER").calculateNextReview(
        underLeitner,
        1,
        NOW
      ).next;
      const afterPersistence = {
        ...lapsed,
        srsData: withMarker ? { algorithm: "LEITNER" } : undefined,
      };

      expect(afterPersistence.state).toBe("LEARNING");
      expect(afterPersistence.repetitions).toBe(8);
      const backUnderSm2 = hydrateStateForAlgorithm(afterPersistence, "SM2");
      expect(backUnderSm2.repetitions).toBe(0);

      const { next } = getAlgorithm("SM2").calculateNextReview(
        backUnderSm2,
        4,
        NOW
      );
      expect(next.repetitions).toBe(1);
      expect(next.intervalDays).toBe(1);
    }
  );

  it("does not change a same-algorithm SM-2 schedule", () => {
    const state = {
      ...buildHistory("SM2", 30, NOW),
      srsData: { algorithm: "SM2" },
    };
    expect(hydrateStateForAlgorithm(state, "SM2")).toEqual(state);
    expect(
      getAlgorithm("SM2").calculateNextReview(state, 4, NOW).next.intervalDays
    ).toBe(Math.round(state.intervalDays * state.easeFactor));
  });

  it("does not change a same-algorithm Leitner schedule", () => {
    const state = {
      ...buildHistory("LEITNER", 16, NOW),
      srsData: { algorithm: "LEITNER" },
    };
    expect(hydrateStateForAlgorithm(state, "LEITNER")).toEqual(state);
    const { next } = getAlgorithm("LEITNER").calculateNextReview(state, 4, NOW);
    expect(next.box).toBe(state.box);
    expect(next.intervalDays).toBe(16);
  });

  it("preserves the normal SM-2 post-lapse first-success interval", () => {
    const state = buildHistory("SM2", 30, NOW);
    const lapsed = getAlgorithm("SM2").calculateNextReview(state, 1, NOW).next;
    const delayedLearning = {
      ...lapsed,
      intervalDays: 20,
      srsData: { algorithm: "LEITNER" },
    };
    const readyForSm2 = hydrateStateForAlgorithm(delayedLearning, "SM2");
    expect(readyForSm2).toEqual(delayedLearning);

    const { next } = getAlgorithm("SM2").calculateNextReview(
      readyForSm2,
      4,
      NOW
    );
    expect(next.state).toBe("REVIEW");
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
  });

  it("preserves Leitner's box-1 success after a lapse", () => {
    const state = buildHistory("LEITNER", 16, NOW);
    const lapsed = getAlgorithm("LEITNER").calculateNextReview(state, 1, NOW).next;
    const delayedLearning = {
      ...lapsed,
      intervalDays: 20,
      srsData: { algorithm: "SM2" },
    };
    const readyForLeitner = hydrateStateForAlgorithm(delayedLearning, "LEITNER");
    expect(readyForLeitner).toEqual(delayedLearning);

    const { next } = getAlgorithm("LEITNER").calculateNextReview(
      readyForLeitner,
      4,
      NOW
    );
    expect(next.state).toBe("REVIEW");
    expect(next.box).toBe(2);
    expect(next.intervalDays).toBe(2);
  });

  it("leaves NEW foreign rows untouched", () => {
    const state = {
      ...getAlgorithm("SM2").initialState(NOW),
      repetitions: 7,
      box: 5,
      intervalDays: 30,
      srsData: { algorithm: "LEITNER" },
    };
    expect(hydrateStateForAlgorithm(state, "SM2")).toEqual(state);
  });

  it("keeps interval modifiers active after SM-2 hydrates a mature interval", () => {
    const source = buildHistory("LEITNER", 8, NOW);
    const hydrated = hydrateStateForAlgorithm(source, "SM2");
    const base = getAlgorithm("SM2").calculateNextReview(hydrated, 4, NOW);
    const result = applyUserModifiers(
      hydrated,
      base,
      4,
      {
        intervalModifier: 1.5,
        lapseModifier: 0,
        masteryThresholdDays: null,
        fuzzIntervals: false,
      },
      NOW
    );
    expect(result.next.intervalDays).toBe(base.next.intervalDays * 1.5);
    expect(result.next.dueAt.getTime()).toBe(
      NOW.getTime() + result.next.intervalDays * 86_400_000
    );
  });
});
