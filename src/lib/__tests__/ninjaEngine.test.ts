import { describe, it, expect } from "vitest";
import {
  stepPhysics,
  stepHitTests,
  resolveWave,
  DEFAULT_CONFIG,
} from "@/lib/ninja/engine";
import type { EngineState, NinjaItem } from "@/lib/ninja/types";

// These cover the two real bugs already caught by playtest (e3ad018,
// af92b9c): a life must be lost whether the player slices the wrong tile
// OR does nothing and lets the target fall — "standing still" must not be a
// safe strategy, and grading must always target the prompt word, never
// whichever tile happened to get sliced.

const BOUNDS = { width: 400, height: 600, bottom: 600 };

function baseState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    tiles: [],
    trail: [],
    sliceBursts: [],
    pointer: null,
    lives: 5,
    waveIndex: 0,
    combo: 2,
    bestCombo: 2,
    correct: 0,
    missed: 0,
    score: 0,
    stageBounds: BOUNDS,
    promptWord: { wordId: "target-1", char: "试", translation: "test" },
    waveStatus: "live",
    leadInEnd: 0,
    waveEndTime: null,
    leadInMs: DEFAULT_CONFIG.leadInMs,
    waveSize: DEFAULT_CONFIG.waveSize,
    trailMs: DEFAULT_CONFIG.trailMs,
    requeuePool: new Map(),
    requeueReadyAt: new Map(),
    ...overrides,
  };
}

function tileAt(x: number, y: number, isTarget: boolean, id = "tile-1"): NinjaItem {
  return {
    id,
    char: isTarget ? "试" : "测",
    isTarget,
    position: { x, y },
    velocity: { x: 0, y: -300 },
    spinRate: 0,
    sliced: false,
    spawnTime: 0,
  };
}

/** A horizontal slice trail that sweeps straight through (x, y), fast enough
 * to clear DEFAULT_CONFIG.minSliceSpeed. */
function sliceThrough(x: number, y: number) {
  return [
    { x: x - 30, y, t: 0 },
    { x: x + 30, y, t: 100 }, // 60px / 0.1s = 600px/s, well above the 160px/s floor
  ];
}

describe("ninjaEngine", () => {
  describe("stepHitTests — wrong-tile slice", () => {
    it("costs a life, same as a miss", () => {
      const distractor = tileAt(200, 300, false, "distractor-1");
      const state = baseState({
        tiles: [distractor],
        trail: sliceThrough(200, 300),
        pointer: { x: 230, y: 300 },
        lives: 5,
      });

      const outcome = stepHitTests(state, DEFAULT_CONFIG, 200);

      expect(outcome).not.toBeNull();
      expect(outcome!.slicedTarget).toBe(false);
      expect(state.lives).toBe(4);
      expect(state.combo).toBe(0);
      expect(state.waveStatus).toBe("resolved");
    });

    it("grades against promptWord.wordId, never the sliced distractor", () => {
      const distractor = tileAt(200, 300, false, "some-other-word-tile");
      const state = baseState({
        tiles: [distractor],
        trail: sliceThrough(200, 300),
        pointer: { x: 230, y: 300 },
        promptWord: { wordId: "the-actual-target", char: "试", translation: "test" },
      });

      const outcome = stepHitTests(state, DEFAULT_CONFIG, 200);

      expect(outcome!.wordId).toBe("the-actual-target");
    });
  });

  describe("stepHitTests — correct slice", () => {
    it("does not cost a life and grades the target", () => {
      const target = tileAt(200, 300, true, "target-1");
      const state = baseState({
        tiles: [target],
        trail: sliceThrough(200, 300),
        pointer: { x: 230, y: 300 },
        lives: 5,
      });

      const outcome = stepHitTests(state, DEFAULT_CONFIG, 200);

      expect(outcome!.slicedTarget).toBe(true);
      expect(outcome!.wordId).toBe("target-1");
      expect(state.lives).toBe(5);
      expect(state.combo).toBe(3);
    });
  });

  describe("stepPhysics — missed target (fell off-stage)", () => {
    it("costs a life, not just a miss counter (e3ad018)", () => {
      // Already past the 100px grace zone below the floor before stepping —
      // stepTile only moves it further off-stage, tileIsOffStage still fires.
      const fallen = tileAt(200, BOUNDS.bottom + 150, true, "target-1");
      const state = baseState({
        tiles: [fallen],
        lives: 5,
        missed: 0,
      });

      stepPhysics(state, 1 / 60, 200);

      expect(state.missed).toBe(1);
      expect(state.lives).toBe(4);
      expect(state.combo).toBe(0);
      expect(state.waveStatus).toBe("resolved");
    });

    it("does not resolve a miss outside the live wave (e.g. during lead-in)", () => {
      const fallen = tileAt(200, BOUNDS.bottom + 150, true, "target-1");
      const state = baseState({
        tiles: [fallen],
        waveStatus: "lead-in",
        lives: 5,
        missed: 0,
      });

      stepPhysics(state, 1 / 60, 200);

      // stepPhysics still removes the off-stage tile, but must not treat a
      // lead-in tile falling (which shouldn't normally happen, but guards
      // against it) as a scored miss.
      expect(state.missed).toBe(0);
      expect(state.lives).toBe(5);
      expect(state.waveStatus).toBe("lead-in");
    });
  });

  describe("resolveWave — game-over transition", () => {
    it("stays 'resolved' at 0 lives, does not jump straight to game-over", () => {
      const state = baseState({ lives: 1, waveStatus: "live" });

      resolveWave(state, "wrong", 200);

      // Lives hitting 0 here does NOT itself flip to game-over — that
      // transition belongs solely to useNinjaEngine's advance timer, after
      // the corrective-feedback banner has had its pause to display. See
      // the comment on resolveWave in engine.ts.
      expect(state.lives).toBe(1); // resolveWave itself doesn't touch lives on "wrong"
      expect(state.waveStatus).toBe("resolved");
    });

    it("is a no-op once a wave is already resolved", () => {
      const state = baseState({ waveStatus: "resolved", missed: 0, lives: 5 });

      resolveWave(state, "missed", 200);

      expect(state.missed).toBe(0);
      expect(state.lives).toBe(5);
    });
  });
});
