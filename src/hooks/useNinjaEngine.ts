/**
 * React hook: ref-held game loop with minimal re-renders.
 * Fixed timestep, coalesced pointer events, ResizeObserver for stage bounds.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  spawnWave,
  spawnListenWave,
  spawnReverseWave,
  stepPhysics,
  stepHitTests,
  decayTrail,
  decaySliceBursts,
  stepWaveLogic,
  DEFAULT_CONFIG,
  type EngineConfig,
  type WaveOutcome as EngineWaveOutcome,
} from "@/lib/ninja/engine";
import type { EngineState, StageBounds, TrailPoint } from "@/lib/ninja/types";
import type { NinjaWord } from "@/lib/ninja/distractors";
import { pickDistractors } from "@/lib/ninja/distractors";
import { buildHomophoneGroups, pickListenWaveTarget, type HomophoneGroup } from "@/lib/ninja/homophones";
import { makeRng } from "@/lib/ninja/physics";
import { WAVES_PER_SESSION, gradeForSession, getDifficultyParams } from "@/lib/ninja/scoring";

// Wave-type distribution:
// - ~25% "Listen & Slice" (audio → hanzi, homophone tiles)
// - ~25% "Reverse" (hanzi → audio/gloss, translation tiles)
// - ~50% "Gloss" (hanzi prompt, english gloss → hanzi, frequency-matched tiles)
// Flat probabilities, no adaptive weighting.
const LISTEN_WAVE_CHANCE = 0.25;
const REVERSE_WAVE_CHANCE = 0.25;

/**
 * Roll for and, if eligible, spawn a "Listen & Slice" wave. Returns true if
 * one was spawned; false means the caller should fall back to a normal
 * gloss wave (either the roll missed, or no group had a usable distractor).
 */
function trySpawnListenWave(
  state: EngineState,
  homophoneGroups: Map<string, HomophoneGroup>,
  rng: () => number,
  now: number,
  waveSize: number,
  listenChance: number = LISTEN_WAVE_CHANCE
): boolean {
  if (rng() >= listenChance) return false;

  const picked = pickListenWaveTarget(homophoneGroups, rng, waveSize);
  if (!picked) return false; // thin/empty groups — fall back to gloss

  spawnListenWave(state, picked.target, picked.distractors, rng, now, waveSize);
  return true;
}

/**
 * Try to spawn a "Reverse" wave: hanzi prompt, English translation tiles.
 * Returns true if spawned, false otherwise.
 */
function trySpawnReverseWave(
  state: EngineState,
  words: NinjaWord[],
  rng: () => number,
  now: number,
  waveSize: number,
  reverseChance: number = REVERSE_WAVE_CHANCE
): boolean {
  if (rng() >= reverseChance) return false;
  if (words.length < waveSize) return false;

  const targetWord = words[Math.floor(rng() * words.length)];
  const distractorPool = words.filter((w) => w.wordId !== targetWord.wordId);
  const distractors = pickDistractors(targetWord, distractorPool, rng, waveSize - 1);

  if (distractors.length === 0) return false;
  spawnReverseWave(state, targetWord, distractors, rng, now, waveSize);
  return true;
}

/**
 * Try to pull a word from the requeue pool. Returns the word if one was
 * dequeued, null otherwise. A word can only requeue once per session.
 */
function tryDequeuRequeueWord(state: EngineState, words: NinjaWord[]): NinjaWord | null {
  if (state.requeuePool.size === 0) return null;

  // Get the first word in the requeue pool
  const entry = state.requeuePool.entries().next().value;
  if (!entry) return null;

  const [wordId, count] = entry as [string, number];

  // Each word requeues at most once (count = 1). Don't dequeue if already requeued.
  if (count >= 1) {
    state.requeuePool.delete(wordId);
    return null;
  }

  // Increment requeue count and find the word in the pool
  state.requeuePool.set(wordId, count + 1);
  const word = words.find((w) => w.wordId === wordId);
  return word ?? null;
}

export interface NinjaOutcomeFeedback {
  kind: "correct" | "wrong" | "missed";
  char: string;
  translation: string;
}

export interface NinjaView {
  lives: number;
  waveIndex: number;
  combo: number;
  bestCombo: number;
  correct: number;
  missed: number;
  promptWord: EngineState["promptWord"];
  waveStatus: EngineState["waveStatus"];
  tiles: Array<{ id: string; char: string; position: { x: number; y: number }; sliced: boolean }>;
  pointer: { x: number; y: number } | null;
  /** Corrective feedback for the wave that just resolved; null before any wave ends. */
  lastOutcome: NinjaOutcomeFeedback | null;
  /** Session grade (S/A/B/C) computed at game-over. */
  grade?: "S" | "A" | "B" | "C";
}

export interface UseNinjaEngineOptions {
  words: NinjaWord[];
  config?: Partial<EngineConfig>;
  onWaveOutcome?: (outcome: EngineWaveOutcome) => void;
}

/**
 * Project engine state into a React view (only interactive fields).
 * Copy position by value to prevent React holding a mutating object.
 */
function projectView(
  state: EngineState,
  lastOutcome: NinjaOutcomeFeedback | null = null
): NinjaView {
  const view: NinjaView = {
    lives: state.lives,
    waveIndex: state.waveIndex,
    combo: state.combo,
    bestCombo: state.bestCombo,
    correct: state.correct,
    missed: state.missed,
    promptWord: state.promptWord,
    waveStatus: state.waveStatus,
    tiles: state.tiles.map((t) => ({
      id: t.id,
      char: t.char,
      position: { x: t.position.x, y: t.position.y },
      sliced: t.sliced,
    })),
    pointer: state.pointer,
    lastOutcome,
  };

  // Compute grade at game-over
  if (state.waveStatus === "game-over") {
    view.grade = gradeForSession(state.correct, state.bestCombo);
  }

  return view;
}

function initialState(): EngineState {
  return {
    tiles: [],
    trail: [],
    sliceBursts: [],
    pointer: null,
    lives: 3,
    waveIndex: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    missed: 0,
    stageBounds: { width: 0, height: 0, bottom: 0 },
    promptWord: { wordId: "", char: "", translation: "" },
    waveStatus: "lead-in",
    leadInEnd: 0,
    waveEndTime: null,
    leadInMs: DEFAULT_CONFIG.leadInMs,
    waveSize: DEFAULT_CONFIG.waveSize,
    trailMs: DEFAULT_CONFIG.trailMs,
    requeuePool: new Map(),
  };
}

export function useNinjaEngine({ words, config = {}, onWaveOutcome }: UseNinjaEngineOptions) {
  // Memoize config so effects have stable dependencies. Stringify first into
  // its own variable — react-hooks/exhaustive-deps requires simple
  // expressions in the dependency array, not inline calls.
  const configKey = JSON.stringify(config);
  // configKey is a stable serialization of config; config itself is
  // typically a fresh {} literal every render, so depending on it directly
  // would defeat the memo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fullConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [configKey]);

  // Built once per session word pool — groups words that sound identical
  // (same toneless pronunciation) but differ by tone, for "Listen & Slice"
  // waves. Empty on most sessions (needs ≥4 single-character words sharing a
  // pronunciation), in which case those waves just never roll.
  const homophoneGroups = useMemo(() => buildHomophoneGroups(words), [words]);

  const stateRef = useRef<EngineState>(initialState());
  // Build the initial view from a fresh initialState() rather than reading
  // stateRef.current here — react-hooks/refs disallows reading a ref during
  // render. initialState() is a pure constructor, so this is equivalent to
  // projecting the ref (both start from the same default shape).
  const [view, setView] = useState<NinjaView>(() => projectView(initialState()));
  const rngRef = useRef(makeRng());
  const stageRef = useRef<HTMLDivElement | null>(null);
  const tileElRefs = useRef(new Map<string, HTMLDivElement>());
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnedRef = useRef(false);
  const lastOutcomeRef = useRef<NinjaOutcomeFeedback | null>(null);
  const prevMissedRef = useRef(0);

  /**
   * Paint tiles into the DOM by writing transforms based on current engine state.
   * Called once per RAF frame to move tiles without triggering React re-renders.
   * The visible circle is 1.8x the character size; center it on tile.position.
   */
  function paint(state: EngineState) {
    if (!stageRef.current) return;
    if (state.tiles.length === 0) return;
    if (state.stageBounds.width <= 0) return; // stageBounds not ready yet

    // Compute tile size (matches NinjaTile.tsx sizing logic exactly)
    // NinjaTile uses: clamp(79.2px, 14.4vw, 129.6px) for width
    // which is 1.8 * clamp(44px, 8vw, 72px)
    const charSizePx = Math.min(
      Math.max(
        fullConfig.tileSizePxMin,
        (fullConfig.tileSizeVw / 100) * state.stageBounds.width
      ),
      fullConfig.tileSizePxMax
    );

    // Visual circle diameter is 1.8x the character size (the backdrop)
    const circleDiameter = charSizePx * 1.8;
    const radius = circleDiameter / 2;

    for (const tile of state.tiles) {
      const el = tileElRefs.current.get(tile.id);
      if (!el) continue;

      // Center the circle on tile.position (x,y is the center point)
      const offsetX = tile.position.x - radius;
      const offsetY = tile.position.y - radius;

      el.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
  }

  // Pointer capture + trail recording, ResizeObserver for stage bounds
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateBounds = () => {
      const rect = stage.getBoundingClientRect();
      stateRef.current.stageBounds = {
        width: rect.width,
        height: rect.height,
        bottom: rect.height,
      };

      if (!spawnedRef.current && rect.width > 0 && words.length > 0) {
        spawnedRef.current = true;
        const state = stateRef.current;
        state.trailMs = fullConfig.trailMs;
        const now = performance.now();

        // Apply difficulty curve for wave 0
        const diffParams = getDifficultyParams(0);
        state.leadInMs = diffParams.leadInMs;
        state.waveSize = diffParams.waveSize;

        // Try wave types in order: Listen > Reverse > Gloss
        let spawned = trySpawnListenWave(state, homophoneGroups, rngRef.current, now, diffParams.waveSize, diffParams.listenChance);
        if (!spawned) {
          spawned = trySpawnReverseWave(state, words, rngRef.current, now, diffParams.waveSize, diffParams.reverseChance);
        }
        if (!spawned) {
          const requeueWord = tryDequeuRequeueWord(state, words);
          const targetWord = requeueWord || words[0];
          const distractorPool = words.filter((w) => w.wordId !== targetWord.wordId);
          spawnWave(state, targetWord, distractorPool, rngRef.current, now, diffParams.waveSize);
        }

        setView(projectView(state));
      }
    };

    const observer = new ResizeObserver(updateBounds);
    observer.observe(stage);

    // Fire once synchronously so tiles spawn immediately if stage has size
    updateBounds();

    function pushTrailPoint(clientX: number, clientY: number) {
      const rect = stage!.getBoundingClientRect();
      const point: TrailPoint = {
        x: clientX - rect.left,
        y: clientY - rect.top,
        t: performance.now(),
      };
      const trail = stateRef.current.trail;
      trail.push(point);
      if (trail.length > fullConfig.trailCap) trail.shift();
      stateRef.current.pointer = { x: point.x, y: point.y };
    }

    let down = false;

    function onPointerDown(e: PointerEvent) {
      // Don't capture the pointer once the game is over — doing so retargets
      // the pointerup/click away from the "Play Again" button, silently
      // breaking it. Slicing input is irrelevant post-game-over anyway.
      if (stateRef.current.waveStatus === "game-over") return;

      down = true;
      stage!.setPointerCapture(e.pointerId);
      stateRef.current.trail = [];
      pushTrailPoint(e.clientX, e.clientY);
    }

    function onPointerMove(e: PointerEvent) {
      if (!down) return;
      const events = e.getCoalescedEvents?.() ?? [e];
      for (const ev of events) pushTrailPoint(ev.clientX, ev.clientY);
    }

    function onPointerUp(e: PointerEvent) {
      down = false;
      try {
        stage!.releasePointerCapture(e.pointerId);
      } catch {
        // no-op
      }
      stateRef.current.pointer = null;
      stateRef.current.trail = [];
    }

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerUp);

    return () => {
      observer.disconnect();
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerUp);
    };
  }, [fullConfig, words, homophoneGroups]);

  // Main RAF loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    function loop(now: number) {
      const state = stateRef.current;
      let dt = (now - last) / 1000;
      last = now;
      dt = Math.min(dt, 0.25); // clamp tab-switch gaps

      if (state.waveStatus === "lead-in" || state.waveStatus === "live") {
        const FIXED = 1 / 60;
        let remaining = dt;
        let substeps = 0;
        while (remaining > 0 && substeps < 5) {
          const step = Math.min(FIXED, remaining);
          stepWaveLogic(state, now);
          if (state.waveStatus === "live") {
            // Capture the prompt before stepPhysics can resolve a "missed" wave
            // and stepHitTests can resolve a "correct"/"wrong" wave — both only
            // flip waveStatus, they don't hand back what the right answer was.
            const promptAtStep = state.promptWord;

            stepPhysics(state, step, now);

            // stepPhysics resolves "missed" directly (target fell off-stage)
            // without returning a WaveOutcome — detect it via the counter.
            if (state.missed > prevMissedRef.current) {
              prevMissedRef.current = state.missed;
              lastOutcomeRef.current = {
                kind: "missed",
                char: promptAtStep.char,
                translation: promptAtStep.translation,
              };
              // Add missed words to requeue pool for immediate re-test
              state.requeuePool.set(promptAtStep.wordId, (state.requeuePool.get(promptAtStep.wordId) ?? 0));
              onWaveOutcome?.({
                wordId: promptAtStep.wordId,
                slicedTarget: false,
                slicedDistractor: false,
                missed: true,
                msToSlice: null,
                quality: 1,
              });
            }

            const outcome = stepHitTests(state, fullConfig, now);
            if (outcome) {
              lastOutcomeRef.current = {
                kind: outcome.slicedTarget ? "correct" : "wrong",
                char: promptAtStep.char,
                translation: promptAtStep.translation,
              };
              // Add missed/wrong words to requeue pool for immediate re-test
              if (!outcome.slicedTarget) {
                state.requeuePool.set(outcome.wordId, (state.requeuePool.get(outcome.wordId) ?? 0));
              }
              onWaveOutcome?.(outcome);
            }
          }
          stepWaveLogic(state, now);
          remaining -= step;
          substeps += 1;
        }
      }

      decayTrail(state, fullConfig, now);
      decaySliceBursts(state, now);
      paint(state);

      if (state.waveStatus === "resolved" || state.waveStatus === "game-over") {
        setView((prev) => {
          const next = projectView(state, lastOutcomeRef.current);
          return prev.waveStatus === next.waveStatus &&
            prev.correct === next.correct &&
            prev.missed === next.missed &&
            prev.lives === next.lives &&
            prev.lastOutcome === next.lastOutcome
            ? prev
            : next;
        });

        if (state.waveStatus === "resolved" && !advanceTimerRef.current) {
          advanceTimerRef.current = setTimeout(() => {
            advanceTimerRef.current = null;
            const s = stateRef.current;
            const nextIndex = s.waveIndex + 1;
            if (nextIndex >= WAVES_PER_SESSION || s.lives <= 0) {
              s.waveStatus = "game-over";
            } else {
              s.waveIndex = nextIndex;
              const now = performance.now();

              // Apply difficulty curve for this wave index
              const diffParams = getDifficultyParams(nextIndex);
              s.leadInMs = diffParams.leadInMs;
              s.waveSize = diffParams.waveSize;

              // Try wave types in order: Listen > Reverse > Gloss
              let spawned = trySpawnListenWave(s, homophoneGroups, rngRef.current, now, diffParams.waveSize, diffParams.listenChance);
              if (!spawned) {
                spawned = trySpawnReverseWave(s, words, rngRef.current, now, diffParams.waveSize, diffParams.reverseChance);
              }
              if (!spawned) {
                const requeueWord = tryDequeuRequeueWord(s, words);
                const targetWord = requeueWord || words[nextIndex % words.length];
                const distractorPool = words.filter((w) => w.wordId !== targetWord.wordId);
                spawnWave(s, targetWord, distractorPool, rngRef.current, now, diffParams.waveSize);
              }
              // Clear corrective feedback now that a fresh wave is live — the
              // previous outcome's flash/toast should not linger past its wave.
              lastOutcomeRef.current = null;
            }
            setView(projectView(s, lastOutcomeRef.current));
          }, fullConfig.advancePauseMs);
        }
      }

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
    // paint is stable internal logic, don't include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullConfig, words, homophoneGroups, onWaveOutcome]);

  return {
    stageRef,
    tileElRefs,
    view,
    stateRef,
  };
}
