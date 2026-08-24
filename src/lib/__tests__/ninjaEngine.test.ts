import { describe, it, expect } from "vitest";
import {
  stepPhysics,
  stepHitTests,
  resolveWave,
  spawnWave,
  stepWaveLogic,
  DEFAULT_CONFIG,
} from "@/lib/ninja/engine";
import { laneLayout } from "@/lib/ninja/layout";
import { makeRng } from "@/lib/ninja/physics";
import type { EngineState, NinjaItem } from "@/lib/ninja/types";
import type { NinjaWord } from "@/lib/ninja/distractors";

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
    pendingWave: null,
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

  describe("spawnWave — deferred tile launch (pacing fix)", () => {
    // Regression coverage for the "too fast / too hard" mobile report: tiles
    // used to launch at spawn time, burning the whole leadInMs window as
    // un-sliceable dead flight. Now a wave is queued (state.pendingWave) and
    // only actually placed on stage once stepWaveLogic crosses leadInEnd.
    const words: NinjaWord[] = [
      { wordId: "w1", term: "试", translation: "test" },
      { wordId: "w2", term: "测", translation: "check" },
      { wordId: "w3", term: "验", translation: "verify" },
      { wordId: "w4", term: "证", translation: "prove" },
    ];

    it("has zero tiles immediately after spawnWave, then exactly laneCount once live", () => {
      const state = baseState({ waveStatus: "lead-in", stageBounds: BOUNDS });
      const rng = makeRng(7);

      spawnWave(state, words[0], words.slice(1), rng, 0, 4, 0);

      expect(state.tiles.length).toBe(0);
      expect(state.pendingWave).not.toBeNull();
      expect(state.waveStatus).toBe("lead-in");

      // Before leadInEnd: still nothing on stage.
      stepWaveLogic(state, state.leadInEnd - 1, rng);
      expect(state.tiles.length).toBe(0);
      expect(state.waveStatus).toBe("lead-in");

      // The instant lead-in ends: tiles appear, one per lane.
      stepWaveLogic(state, state.leadInEnd, rng);
      const layout = laneLayout(BOUNDS, 4);
      expect(state.waveStatus).toBe("live");
      expect(state.tiles.length).toBe(layout.laneCount);
      expect(state.pendingWave).toBeNull();
    });
  });

  describe("spawnWave — font size fits a multi-character term (我们 wrap fix)", () => {
    it("sizes a 2-character term to fit the phone-width tile's inner circle", () => {
      const phoneBounds = { width: 375, height: 700, bottom: 700 };
      const state = baseState({ waveStatus: "lead-in", stageBounds: phoneBounds });
      const rng = makeRng(11);
      const twoCharWords: NinjaWord[] = [
        { wordId: "women", term: "我们", translation: "we" },
        { wordId: "w2", term: "测", translation: "check" },
        { wordId: "w3", term: "验", translation: "verify" },
      ];

      spawnWave(state, twoCharWords[0], twoCharWords.slice(1), rng, 0, 4, 0);
      stepWaveLogic(state, state.leadInEnd, rng);

      const layout = laneLayout(phoneBounds, 4);
      const targetTile = state.tiles.find((t) => t.isTarget)!;
      expect(targetTile.fontSize).toBeDefined();
      // The old fixed clamp ladder gave 2-char terms a 44px floor against a
      // 79.2px phone tile inner box — with px-1.5 padding that overflowed
      // onto two lines. The derived size must fit two glyphs inside 78% of
      // the real circle diameter for this viewport.
      const maxFit = (layout.targetCircleDiameterPx * 0.78) / 2;
      expect(targetTile.fontSize!).toBeLessThanOrEqual(maxFit + 0.01);
      expect(targetTile.fontSize!).toBeGreaterThan(0);
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
