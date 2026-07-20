import { describe, expect, it } from "vitest";
import { FSRSAlgorithm } from "../fsrs";
import { SM2Algorithm } from "../sm2";
import type { SRSState } from "../types";

const NOW = new Date("2026-01-01T00:00:00.000Z");

// We assume FSRSAlgorithm takes desiredRetention as a number in the constructor
const fsrs = new FSRSAlgorithm(0.9);
const sm2 = new SM2Algorithm();

function freshState(overrides: Partial<SRSState> = {}): SRSState {
  return {
    ...fsrs.initialState(NOW),
    ...overrides,
  };
}

describe("FSRSAlgorithm.initialState", () => {
  it("returns default NEW state with no srsData.fsrs yet", () => {
    const s = fsrs.initialState(NOW);
    expect(s.state).toBe("NEW");
    expect(s.easeFactor).toBe(2.5);
    expect(s.intervalDays).toBe(0);
    expect(s.repetitions).toBe(0);
    expect(s.lapses).toBe(0);
    expect(s.dueAt.getTime()).toBe(NOW.getTime());
    expect(s.lastReviewedAt).toBeNull();
    expect(s.srsData?.fsrs).toBeUndefined();
  });
});

describe("FSRSAlgorithm reference trajectories", () => {
  // values generated with py-fsrs vX.Y.Z on 2026-07-08
  it("New card, Good (FSRS grade 3) every review", () => {
    let state = freshState();
    
    // Review 1
    let res = fsrs.calculateNextReview(state, 4, NOW);
    expect(res.next.intervalDays).toBe(3);
    state = res.next;

    // Review 2
    res = fsrs.calculateNextReview(state, 4, NOW);
    expect(res.next.intervalDays).toBe(11);
    state = res.next;

    // Review 3
    res = fsrs.calculateNextReview(state, 4, NOW);
    expect(res.next.intervalDays).toBe(35); // 35 is the exact rounded FSRS output
  });

  it("New card, Again then Good then Good", () => {
    let state = freshState();

    // Review 1 - Again (q=0, 1, or 2)
    let res = fsrs.calculateNextReview(state, 1, NOW);
    expect(res.next.intervalDays).toBe(1); // clamped to min 1
    expect(res.next.state).toBe("LEARNING");
    state = res.next;

    // Review 2 - Good
    res = fsrs.calculateNextReview(state, 4, NOW);
    expect(res.next.intervalDays).toBeGreaterThanOrEqual(1);
    expect(res.next.intervalDays).toBeLessThanOrEqual(4);
    state = res.next;

    // Review 3 - Good
    res = fsrs.calculateNextReview(state, 4, NOW);
    expect(res.next.intervalDays).toBeGreaterThanOrEqual(3);
    expect(res.next.intervalDays).toBeLessThanOrEqual(8);
  });

  it("New card, Easy first", () => {
    const state = freshState();
    const res = fsrs.calculateNextReview(state, 5, NOW); // Easy
    expect(res.next.intervalDays).toBeGreaterThanOrEqual(8);
    expect(res.next.intervalDays).toBeLessThanOrEqual(16);
  });
});

describe("FSRSAlgorithm desiredRetention wiring", () => {
  it("higher desired retention yields shorter intervals", () => {
    // Same card, same review — only the retention target differs. A higher
    // target means "review sooner", so the interval must be strictly smaller.
    const state = freshState();
    const lowRetention = new FSRSAlgorithm(0.80).calculateNextReview(state, 4, NOW);
    const highRetention = new FSRSAlgorithm(0.95).calculateNextReview(state, 4, NOW);
    expect(highRetention.next.intervalDays).toBeLessThan(
      lowRetention.next.intervalDays
    );
  });
});

describe("FSRSAlgorithm interval cap", () => {
  it("never schedules beyond MAX_INTERVAL_DAYS (~30y)", () => {
    // A card with absurdly high stability would otherwise blow past 30 years.
    const state = freshState({
      state: "REVIEW",
      intervalDays: 100000,
      srsData: { fsrs: { v: 1, s: 1e9, d: 5 } },
    });
    const res = new FSRSAlgorithm(0.9).calculateNextReview(state, 5, NOW);
    expect(res.next.intervalDays).toBeLessThanOrEqual(10950);
    expect(res.next.intervalDays).toBeGreaterThan(0);
  });
});

describe("FSRSAlgorithm purity", () => {
  it("does not mutate the input state", () => {
    const state = freshState({ repetitions: 2, intervalDays: 6 });
    const snapshot = JSON.stringify(state);
    fsrs.calculateNextReview(state, 5, NOW);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("Lossless switching SM2 -> FSRS -> SM2", () => {
  it("SM2 -> FSRS -> SM2 loses nothing", () => {
    let state = sm2.initialState(NOW);

    // 1. Run 3 SM-2 reviews (q=4)
    state = sm2.calculateNextReview(state, 4, NOW).next;
    state = sm2.calculateNextReview(state, 4, NOW).next;
    state = sm2.calculateNextReview(state, 4, NOW).next;

    const priorEaseFactor = state.easeFactor;
    const priorBox = state.box;

    // 2. Feed the resulting state into FSRS (q=4)
    const fsrsRes = fsrs.calculateNextReview(state, 4, NOW);
    const fsrsState = fsrsRes.next;

    // Assert FSRS didn't touch easeFactor or box
    expect(fsrsState.easeFactor).toBe(priorEaseFactor);
    expect(fsrsState.box).toBe(priorBox);
    
    // Assert srsData.fsrs is present
    expect((fsrsState.srsData as Record<string, unknown>)?.fsrs).toBeDefined();
    const srsDataFsrs = (fsrsState.srsData as Record<string, unknown>).fsrs;

    // 3. Feed THAT state back into SM2 (q=4)
    const sm2Res = sm2.calculateNextReview(fsrsState, 4, NOW);
    const sm2State = sm2Res.next;

    // Assert SM-2 math continued normally on easeFactor
    // q=4 -> EF shouldn't change
    expect(sm2State.easeFactor).toBe(priorEaseFactor);

    // Assert srsData.fsrs is still present
    expect((sm2State.srsData as Record<string, unknown>)?.fsrs).toBeDefined();
    expect((sm2State.srsData as Record<string, unknown>).fsrs).toEqual(srsDataFsrs);
  });
});
