/**
 * React hook: ref-held game loop with minimal re-renders.
 * Fixed timestep, coalesced pointer events, ResizeObserver for stage bounds.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  spawnWave,
  stepPhysics,
  stepHitTests,
  decayTrail,
  decaySliceBursts,
  stepWaveLogic,
  DEFAULT_CONFIG,
  type EngineConfig,
  type WaveOutcome as EngineWaveOutcome,
} from "@/lib/ninja/engine";
import type { EngineState, TrailPoint } from "@/lib/ninja/types";
import type { NinjaWord } from "@/lib/ninja/distractors";
import { makeRng } from "@/lib/ninja/physics";
import {
  initialDifficultyState,
  nextDifficulty,
  paramsForLevel,
  type DifficultyState,
} from "@/lib/ninja/difficulty";

// Expanding-gap requeue: a missed/wrong word reappears REQUEUE_GAPS[n] waves
// after its (n+1)-th miss, then stops requeuing (max 2 re-tests per word per
// run). Expanding retrieval practice beats a single immediate re-test —
// spacing the second re-test out further is what makes it stick.
const REQUEUE_GAPS = [2, 5];

/**
 * Mark a word as due for requeue after its schedule's next gap. Call this
 * whenever a wave resolves as wrong/missed.
 */
function scheduleRequeue(state: EngineState, wordId: string): void {
  const count = state.requeuePool.get(wordId) ?? 0;
  if (count >= REQUEUE_GAPS.length) return; // already used both re-tests
  state.requeuePool.set(wordId, count + 1);
  state.requeueReadyAt.set(wordId, state.waveIndex + REQUEUE_GAPS[count]);
}

/**
 * Try to pull a word from the requeue pool whose gap has elapsed. Returns
 * the word if one was dequeued, null otherwise. Dequeues the longest-waiting
 * word (earliest readyAt) to prevent later-scheduled words from jumping the queue.
 */
function tryDequeuRequeueWord(state: EngineState, words: NinjaWord[]): NinjaWord | null {
  let earliestWordId: string | null = null;
  let earliestReadyAt = Infinity;

  for (const [wordId, readyAt] of state.requeueReadyAt) {
    if (state.waveIndex < readyAt) continue;
    if (readyAt < earliestReadyAt) {
      earliestWordId = wordId;
      earliestReadyAt = readyAt;
    }
  }

  if (earliestWordId) {
    state.requeueReadyAt.delete(earliestWordId);
    const word = words.find((w) => w.wordId === earliestWordId);
    if (word) return word;
  }

  return null;
}

export interface NinjaOutcomeFeedback {
  kind: "correct" | "wrong" | "missed";
  char: string;
  translation: string;
  phonetic?: string;
}

export interface NinjaView {
  lives: number;
  waveIndex: number;
  combo: number;
  bestCombo: number;
  correct: number;
  missed: number;
  score: number;
  promptWord: EngineState["promptWord"];
  waveStatus: EngineState["waveStatus"];
  tiles: Array<{
    id: string;
    char: string;
    position: { x: number; y: number };
    sliced: boolean;
    fontSize?: string;
  }>;
  pointer: { x: number; y: number } | null;
  /** Corrective feedback for the wave that just resolved; null before any wave ends. */
  lastOutcome: NinjaOutcomeFeedback | null;
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
    score: state.score,
    promptWord: state.promptWord,
    waveStatus: state.waveStatus,
    tiles: state.tiles.map((t) => ({
      id: t.id,
      char: t.char,
      position: { x: t.position.x, y: t.position.y },
      sliced: t.sliced,
      fontSize: t.fontSize,
    })),
    pointer: state.pointer,
    lastOutcome,
  };

  return view;
}

function initialState(): EngineState {
  return {
    tiles: [],
    trail: [],
    sliceBursts: [],
    pointer: null,
    lives: 5, // Expanded from 3 to reduce "unlucky early death" noise
              // and preserve expanding-gap requeue mechanics.
    waveIndex: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    missed: 0,
    score: 0,
    stageBounds: { width: 0, height: 0, bottom: 0 },
    promptWord: { wordId: "", char: "", translation: "" },
    waveStatus: "lead-in",
    leadInEnd: 0,
    waveEndTime: null,
    leadInMs: DEFAULT_CONFIG.leadInMs,
    waveSize: DEFAULT_CONFIG.waveSize,
    trailMs: DEFAULT_CONFIG.trailMs,
    requeuePool: new Map(),
    requeueReadyAt: new Map(),
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

  const stateRef = useRef<EngineState>(initialState());
  // Adaptive difficulty: tracks rolling accuracy and nudges leadInMs /
  // distractorCloseness toward the ~85% band. Plain ref, not React state —
  // it's read/written every wave, same lifetime rules as stateRef.
  const difficultyRef = useRef<DifficultyState>(initialDifficultyState());
  // Build the initial view from a fresh initialState() rather than reading
  // stateRef.current here — react-hooks/refs disallows reading a ref during
  // render. initialState() is a pure constructor, so this is equivalent to
  // projecting the ref (both start from the same default shape).
  const [view, setView] = useState<NinjaView>(() => projectView(initialState()));
  // Reseeded with a random value on mount (see the effect below) instead of
  // staying at the default seed=0 — a fixed seed made every session replay
  // the exact same distractor sampling (and, combined with the fixed
  // target-word walk below, the exact same overall wave order) on every
  // restart. Date.now/Math.random can't run here directly (impure calls
  // during render — react-hooks/purity); makeRng(0) is just the placeholder
  // until the mount effect below reseeds it, before wave 0 ever spawns.
  const rngRef = useRef(makeRng(0));
  useEffect(() => {
    rngRef.current = makeRng((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  }, []);
  // Target-word order: a shuffled copy of `words`, built once per session
  // (populated lazily below, right before wave 0 spawns) rather than reused
  // as `words[nextIndex % words.length]` directly. The API returns `words`
  // in a stable order every fetch, so walking it unshuffled meant the exact
  // same target sequence on every restart — this is what actually fixes the
  // "same order every time" report, not just the RNG reseed above (which
  // only randomizes distractor sampling, not which word comes up when).
  const shuffledWordsRef = useRef<NinjaWord[]>([]);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const tileElRefs = useRef(new Map<string, HTMLDivElement>());
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnedRef = useRef(false);
  const lastOutcomeRef = useRef<NinjaOutcomeFeedback | null>(null);
  const prevMissedRef = useRef(0);
  // Callers (e.g. NinjaScreen) typically pass an inline onWaveOutcome that's
  // a fresh function identity every render. Read it via a ref that's kept
  // current below, rather than putting it in the game-loop effect's
  // dependency array — otherwise every wave outcome (which triggers a
  // parent re-render) tears down and restarts the whole RAF loop.
  const onWaveOutcomeRef = useRef(onWaveOutcome);
  useEffect(() => {
    onWaveOutcomeRef.current = onWaveOutcome;
  }, [onWaveOutcome]);

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

        // Fisher-Yates, seeded by this session's own rngRef so it's a
        // different order every restart — built once, right before it's
        // first needed.
        const shuffled = [...words];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rngRef.current() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        shuffledWordsRef.current = shuffled;

        // Apply difficulty curve for wave 0 (level 0 — the controller hasn't
        // seen any outcomes yet).
        const diffParams = paramsForLevel(difficultyRef.current.level);
        state.leadInMs = diffParams.leadInMs;

        const requeueWord = tryDequeuRequeueWord(state, words);
        const targetWord = requeueWord || shuffledWordsRef.current[0];
        const distractorPool = words.filter((w) => w.wordId !== targetWord.wordId);
        spawnWave(state, targetWord, distractorPool, rngRef.current, now, state.waveSize, diffParams.distractorCloseness);

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
  }, [fullConfig, words]);

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
                phonetic: promptAtStep.phonetic,
              };
              scheduleRequeue(state, promptAtStep.wordId);
              difficultyRef.current = nextDifficulty(difficultyRef.current, false);
              onWaveOutcomeRef.current?.({
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
                phonetic: promptAtStep.phonetic,
              };
              if (!outcome.slicedTarget) {
                scheduleRequeue(state, outcome.wordId);
              }
              difficultyRef.current = nextDifficulty(difficultyRef.current, outcome.slicedTarget);
              onWaveOutcomeRef.current?.(outcome);
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
          // Asymmetric pause: correct answers advance quickly (preserving flow),
          // but misses/wrong slices get extra time to read the corrective banner.
          // This helps retention (delay-retention effect from learning research)
          // without interrupting the arcade rhythm on the dominant case (correct).
          // Expanding-gap requeue mechanics also benefit: more waves = more
          // re-tests get scheduled before game-over.
          const pauseMs = lastOutcomeRef.current?.kind === "correct"
            ? fullConfig.advancePauseMs // 1700ms
            : 3000; // ~3s for wrong/missed to read the correction

          advanceTimerRef.current = setTimeout(() => {
            advanceTimerRef.current = null;
            const s = stateRef.current;
            const nextIndex = s.waveIndex + 1;
            if (s.lives <= 0) {
              s.waveStatus = "game-over";
            } else {
              s.waveIndex = nextIndex;
              const now = performance.now();

              // Apply the adaptive difficulty curve for this wave.
              const diffParams = paramsForLevel(difficultyRef.current.level);
              s.leadInMs = diffParams.leadInMs;

              const requeueWord = tryDequeuRequeueWord(s, words);
              const shuffled = shuffledWordsRef.current;
              const targetWord = requeueWord || shuffled[nextIndex % shuffled.length];
              const distractorPool = words.filter((w) => w.wordId !== targetWord.wordId);
              spawnWave(s, targetWord, distractorPool, rngRef.current, now, s.waveSize, diffParams.distractorCloseness);
              // Clear corrective feedback now that a fresh wave is live — the
              // previous outcome's flash/toast should not linger past its wave.
              lastOutcomeRef.current = null;
            }
            setView(projectView(s, lastOutcomeRef.current));
          }, pauseMs);
        }
      }

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      // Must null the ref, not just clear the timer — advanceTimerRef
      // survives this effect's teardown (it's a ref), so leaving a stale
      // non-null value here permanently blocks `!advanceTimerRef.current`
      // from re-arming the next wave's advance timer if this effect ever
      // restarts while a wave is "resolved" and waiting to advance.
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
    // onWaveOutcome intentionally excluded — read via onWaveOutcomeRef so an
    // inline callback identity doesn't restart the whole RAF loop every wave.
    // paint is stable internal logic, don't include in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullConfig, words]);

  return {
    stageRef,
    tileElRefs,
    view,
    stateRef,
  };
}
